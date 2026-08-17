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


/*
 * Detect whether the user is asking
 * specifically for fresher / entry-level jobs.
 */
function isFresherSearch(query) {
  const text = normalize(query);

  return (
    text.includes("fresher") ||
    text.includes("freshers") ||
    text.includes("entry level") ||
    text.includes("entry-level") ||
    text.includes("graduate") ||
    text.includes("new grad") ||
    text.includes("trainee") ||
    text.includes("intern") ||
    text.includes("internship") ||
    text.includes("0 year") ||
    text.includes("0-1 year") ||
    text.includes("0 1 year")
  );
}


/*
 * Extract experience requirements.
 *
 * Handles:
 *
 * 4.00-8.00 Years
 * 4-8 Years
 * 4 to 8 Years
 * 4+ Years
 * 2 Years
 * 1.5 years
 * Minimum 2 years
 */
function extractExperienceRange(job) {
  const text = cleanText(
    `${job.title || ""} ${
      job.description || ""
    }`
  );

  /*
   * Example:
   * Experience: 4.00-8.00 Years
   */
  let match = text.match(
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i
  );

  if (match) {
    return {
      min: parseFloat(match[1]),
      max: parseFloat(match[2]),
      text: `${match[1]}-${match[2]} years`
    };
  }


  /*
   * Example:
   * 4+ years
   */
  match = text.match(
    /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/i
  );

  if (match) {
    const years = parseFloat(match[1]);

    return {
      min: years,
      max: years,
      text: `${match[1]}+ years`
    };
  }


  /*
   * Example:
   * minimum 4 years
   */
  match = text.match(
    /(?:minimum|min\.?|at least)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i
  );

  if (match) {
    const years = parseFloat(match[1]);

    return {
      min: years,
      max: years,
      text: `${match[1]}+ years`
    };
  }


  /*
   * Example:
   * 2 years of experience
   */
  match = text.match(
    /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:of\s*)?experience/i
  );

  if (match) {
    const years = parseFloat(match[1]);

    return {
      min: years,
      max: years,
      text: `${match[1]} years`
    };
  }


  /*
   * Explicit fresher / entry-level wording.
   */
  if (
    /fresher|freshers|entry[- ]level|graduate|new grad|trainee|internship|intern/i.test(
      text
    )
  ) {
    return {
      min: 0,
      max: 0,
      text: "Fresher / Entry Level"
    };
  }


  return {
    min: null,
    max: null,
    text: "Not specified"
  };
}


/*
 * Decide whether a job should be rejected
 * for a fresher search.
 */
function shouldRejectForFresher(
  job,
  query
) {
  if (!isFresherSearch(query)) {
    return false;
  }

  const experience =
    extractExperienceRange(job);

  /*
   * If the job explicitly requires
   * more than 1 year, reject it.
   */
  if (
    experience.max !== null &&
    experience.max > 1
  ) {
    return true;
  }


  /*
   * If the minimum is more than 1,
   * definitely reject it.
   */
  if (
    experience.min !== null &&
    experience.min > 1
  ) {
    return true;
  }


  /*
   * Reject obvious senior roles.
   */
  const title =
    normalize(job.title);

  const seniorTerms = [
    "senior",
    "sr.",
    "sr ",
    "lead",
    "principal",
    "staff",
    "manager",
    "architect",
    "director",
    "head of",
    "associate director"
  ];

  if (
    seniorTerms.some(
      (term) =>
        title.includes(
          normalize(term)
        )
    )
  ) {
    return true;
  }


  return false;
}


/*
 * Extract skills relevant to the
 * user's resume/query.
 */
function getKeywords(
  query,
  resumeText
) {
  const source =
    normalize(
      `${query} ${resumeText}`
    );

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

  return knownSkills.filter(
    (skill) =>
      source.includes(
        normalize(skill)
      )
  );
}


/*
 * Calculate a simple profile match.
 */
function calculateMatch(
  job,
  resumeText,
  query
) {
  const title =
    normalize(job.title);

  const description =
    normalize(
      cleanText(
        job.description
      )
    );

  const combined =
    `${title} ${description}`;

  const keywords =
    getKeywords(
      query,
      resumeText
    );

  let matched = 0;

  for (
    const keyword of keywords
  ) {
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


  for (
    const role of positiveRoles
  ) {
    if (
      title.includes(
        normalize(role)
      )
    ) {
      roleScore += 8;
    }
  }


  roleScore =
    Math.min(
      roleScore,
      25
    );


  let experienceScore = 20;

  const experience =
    extractExperienceRange(
      job
    );


  /*
   * Fresher-friendly jobs
   * get the experience bonus.
   */
  if (
    experience.max !== null
  ) {
    if (
      experience.max <= 1
    ) {
      experienceScore = 20;
    } else if (
      experience.max <= 2
    ) {
      experienceScore = 8;
    } else {
      experienceScore = 0;
    }
  }


  /*
   * Senior titles get zero
   * experience score.
   */
  const seniorTerms = [
    "senior",
    "lead",
    "principal",
    "staff",
    "manager",
    "architect",
    "director"
  ];


  if (
    seniorTerms.some(
      (term) =>
        title.includes(term)
    )
  ) {
    experienceScore = 0;
  }


  const score = Math.max(
    0,
    Math.min(
      100,
      skillScore +
        roleScore +
        experienceScore
    )
  );


  return score;
}


/*
 * Create search terms from the
 * user's request.
 */
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
      "DevOps Trainee"
    );

    terms.push(
      "Cloud Engineer"
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
  ].slice(
    0,
    4
  );
}


/*
 * Search Adzuna.
 */
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


  if (
    !response.ok
  ) {
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


/*
 * Main Vercel API handler.
 */
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
     * Remove duplicates.
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
     * Filter jobs BEFORE scoring.
     *
     * This is the important fix.
     */
    const filtered =
      Array.from(
        uniqueJobs.values()
      ).filter(
        (job) =>
          !shouldRejectForFresher(
            job,
            query
          )
      );


    /*
     * Convert into SEGA job cards.
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


            const experience =
              extractExperienceRange(
                job
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
                experience.text,

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
