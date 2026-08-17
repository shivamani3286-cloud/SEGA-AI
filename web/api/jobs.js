function json(res, status, body) {
  res.statusCode = status;
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  return res.end(
    JSON.stringify(body)
  );
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getKeywords(query, resumeText) {
  const source = `${query} ${resumeText}`;

  const knownSkills = [
    "aws",
    "azure",
    "gcp",
    "docker",
    "kubernetes",
    "terraform",
    "ansible",
    "jenkins",
    "github actions",
    "git",
    "linux",
    "python",
    "bash",
    "shell",
    "ci/cd",
    "cicd",
    "devops",
    "cloud",
    "ec2",
    "s3",
    "lambda",
    "rds",
    "vpc",
    "nginx",
    "redis",
    "mysql",
    "postgresql",
    "maven",
    "gradle",
    "java",
    "node.js",
    "node",
    "react"
  ];

  const normalizedSource =
    normalize(source);

  return knownSkills.filter(
    (skill) =>
      normalizedSource.includes(
        normalize(skill)
      )
  );
}

function calculateMatch(
  job,
  resumeText,
  query
) {
  const title = normalize(
    job.title
  );

  const description = normalize(
    cleanText(job.description)
  );

  const location = normalize(
    job.location?.display_name
  );

  const combined = `${title} ${description}`;

  const keywords = getKeywords(
    query,
    resumeText
  );

  let matched = 0;

  for (const keyword of keywords) {
    if (
      combined.includes(
        normalize(keyword)
      )
    ) {
      matched++;
    }
  }

  const skillScore =
    keywords.length > 0
      ? Math.round(
          (matched /
            keywords.length) *
            55
        )
      : 25;

  let roleScore = 0;

  const positiveRoles = [
    "devops",
    "cloud engineer",
    "cloud",
    "site reliability",
    "sre",
    "aws",
    "platform engineer",
    "infrastructure",
    "automation",
    "software engineer",
    "backend",
    "system engineer",
    "linux"
  ];

  for (const role of positiveRoles) {
    if (
      title.includes(
        normalize(role)
      )
    ) {
      roleScore += 8;
    }
  }

  roleScore = Math.min(
    roleScore,
    25
  );

  let experienceScore = 20;

  const negativeExperience =
    /(?:3|4|5|6|7|8|9|\d{2,})\+?\s*(?:years?|yrs?)/i;

  const experienceText =
    `${job.title || ""} ${
      job.description || ""
    }`;

  const experienceMatch =
    experienceText.match(
      negativeExperience
    );

  if (
    experienceMatch
  ) {
    const years =
      parseInt(
        experienceMatch[0],
        10
      );

    if (years >= 3) {
      experienceScore = 0;
    } else if (years === 2) {
      experienceScore = 8;
    } else {
      experienceScore = 15;
    }
  }

  const seniorWords = [
    "senior",
    "lead",
    "principal",
    "staff",
    "manager",
    "architect",
    "director",
    "head of"
  ];

  for (const word of seniorWords) {
    if (title.includes(word)) {
      experienceScore = 0;
      break;
    }
  }

  const remoteBoost =
    location.includes("remote")
      ? 3
      : 0;

  const score = Math.max(
    0,
    Math.min(
      100,
      skillScore +
        roleScore +
        experienceScore +
        remoteBoost
    )
  );

  return score;
}

function extractExperience(job) {
  const text = cleanText(
    `${job.title || ""} ${
      job.description || ""
    }`
  );

  const patterns = [
    /(?:minimum|min\.?|at least)\s*(\d+)\s*(?:years?|yrs?)/i,

    /(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yrs?)/i,

    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?experience/i
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      text.match(pattern);

    if (match) {
      if (
        match[2]
      ) {
        return `${match[1]}-${match[2]} years`;
      }

      return `${match[1]}+ years`;
    }
  }

  if (
    /fresher|entry[- ]level|graduate|trainee|internship|intern/i.test(
      text
    )
  ) {
    return "Fresher / Entry Level";
  }

  return "Not specified";
}

function isClearlySenior(job) {
  const text =
    normalize(
      `${job.title || ""} ${
        job.description || ""
      }`
    );

  const seniorTerms = [
    "senior devops",
    "lead devops",
    "principal devops",
    "senior cloud",
    "lead cloud",
    "principal cloud",
    "devops manager",
    "engineering manager",
    "platform architect",
    "solution architect",
    "director of"
  ];

  return seniorTerms.some(
    (term) =>
      text.includes(term)
  );
}

function makeSearchTerms(
  query
) {
  const normalized =
    normalize(query);

  const terms = [];

  terms.push(
    normalized
  );

  if (
    normalized.includes(
      "devops"
    )
  ) {
    terms.push(
      "DevOps"
    );

    terms.push(
      "Cloud Engineer"
    );

    terms.push(
      "DevOps Trainee"
    );
  }

  if (
    normalized.includes(
      "aws"
    )
  ) {
    terms.push(
      "AWS Cloud Engineer"
    );
  }

  if (
    normalized.includes(
      "cloud"
    )
  ) {
    terms.push(
      "Cloud Engineer"
    );
  }

  if (
    normalized.includes(
      "kubernetes"
    )
  ) {
    terms.push(
      "Kubernetes"
    );
  }

  return [
    ...new Set(
      terms
    )
  ].slice(0, 4);
}

async function searchAdzuna({
  appId,
  appKey,
  what,
  where
}) {
  const url =
    new URL(
      "https://api.adzuna.com/v1/api/jobs/in/search/1"
    );

  url.searchParams.set(
    "app_id",
    appId
  );

  url.searchParams.set(
    "app_key",
    appKey
  );

  url.searchParams.set(
    "results_per_page",
    "20"
  );

  url.searchParams.set(
    "what",
    what
  );

  if (where) {
    url.searchParams.set(
      "where",
      where
    );
  }

  url.searchParams.set(
    "content-type",
    "application/json"
  );

  const response =
    await fetch(
      url.toString(),
      {
        headers: {
          Accept:
            "application/json"
        }
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.exception ||
        data?.error ||
        `Adzuna returned HTTP ${response.status}.`
    );
  }

  return Array.isArray(
    data?.results
  )
    ? data.results
    : [];
}

export default async function handler(
  req,
  res
) {
  if (
    req.method !== "POST"
  ) {
    return json(
      res,
      405,
      {
        error:
          "Method not allowed"
      }
    );
  }

  try {
    const body =
      typeof req.body ===
      "string"
        ? JSON.parse(
            req.body
          )
        : req.body || {};

    const query =
      String(
        body.query || ""
      ).trim();

    const resumeText =
      String(
        body.resumeText ||
          ""
      ).slice(
        0,
        50000
      );

    const profile =
      body.profile || {};

    if (!query) {
      return json(
        res,
        400,
        {
          error:
            "Job search query is required."
        }
      );
    }

    const appId =
      process.env.ADZUNA_APP_ID;

    const appKey =
      process.env.ADZUNA_APP_KEY;

    if (
      !appId ||
      !appKey
    ) {
      return json(
        res,
        500,
        {
          error:
            "Adzuna is not configured. Add ADZUNA_APP_ID and ADZUNA_APP_KEY to Vercel Environment Variables."
        }
      );
    }

    const searchTerms =
      makeSearchTerms(
        query
      );

    const location =
      String(
        profile.location ||
          ""
      ).trim();

    let allJobs = [];

    for (
      const searchTerm of searchTerms
    ) {
      try {
        const results =
          await searchAdzuna(
            {
              appId,
              appKey,
              what: searchTerm,
              where: location
            }
          );

        allJobs.push(
          ...results
        );
      } catch (error) {
        console.error(
          `Adzuna search failed for "${searchTerm}":`,
          error.message
        );
      }
    }

    /*
     * Remove duplicate listings.
     */

    const uniqueJobs =
      new Map();

    for (
      const job of allJobs
    ) {
      const key =
        String(
          job.id ||
            job.redirect_url ||
            `${job.company?.display_name}-${job.title}`
        );

      if (
        !uniqueJobs.has(key)
      ) {
        uniqueJobs.set(
          key,
          job
        );
      }
    }

    /*
     * Filter obvious senior jobs.
     */

    const filtered =
      Array.from(
        uniqueJobs.values()
      ).filter(
        (job) =>
          !isClearlySenior(
            job
          )
      );

    /*
     * Convert API results into
     * the exact shape your current
     * SEGA Job Agent expects.
     */

    const jobs =
      filtered
        .map(
          (job) => {
            const title =
              cleanText(
                job.title
              );

            const company =
              cleanText(
                job.company
                  ?.display_name ||
                  "Unknown company"
              );

            const description =
              cleanText(
                job.description
              );

            const locationName =
              cleanText(
                job.location
                  ?.display_name ||
                  location ||
                  "Not specified"
              );

            const applicationUrl =
              String(
                job.redirect_url ||
                  ""
              );

            const matchScore =
              calculateMatch(
                job,
                resumeText,
                query
              );

            const skills =
              getKeywords(
                query,
                `${resumeText} ${description} ${title}`
              );

            return {
              company,

              title,

              location:
                locationName,

              experience:
                extractExperience(
                  job
                ),

              url:
                applicationUrl,

              applicationUrl,

              matchScore,

              reason:
                skills.length
                  ? `Matches your profile through: ${skills
                      .slice(
                        0,
                        6
                      )
                      .join(
                        ", "
                      )}.`
                  : "Potentially relevant to your requested role and location.",

              skills,

              source:
                "Adzuna",

              jobId:
                String(
                  job.id ||
                    ""
                )
            };
          }
        )
        .filter(
          (job) =>
            job.applicationUrl
        )
        .sort(
          (a, b) =>
            b.matchScore -
            a.matchScore
        )
        .slice(
          0,
          12
        );

    return json(
      res,
      200,
      {
        jobs
      }
    );
  } catch (error) {
    console.error(
      "SEGA jobs API error:",
      error
    );

    return json(
      res,
      500,
      {
        error:
          error?.message ||
          "SEGA could not search for jobs."
      }
    );
  }
}
