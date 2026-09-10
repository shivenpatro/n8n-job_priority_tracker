/**
 * NLP & Token Extraction Layer for Tech Job Market & Skill Arbitrage Monitor
 * Provides deduplication, HTML/Markdown sanitization, salary normalization,
 * and bounded regex skill/role extraction.
 */

const crypto = require('crypto');

// Bounded Taxonomy Pattern Definitions
const TAXONOMY_PATTERNS = {
  languages: {
    'Python': [/\bpython3?\b/i, /\bpy\b/i],
    'TypeScript': [/\btypescript\b/i, /\bts\b/i],
    'JavaScript': [/\bjavascript\b/i, /\bjs\b/i, /\bes6\b/i, /\becmascript\b/i],
    'Go': [/\bgolang\b/i, /\bGo\b/, /\bgo\s+(?:developer|engineer|dev|programming|lang|backend|stack)\b/i],
    'Rust': [/\brust\b/i, /\brustlang\b/i],
    'Java': [/\bjava\b/i, /\bjvm\b/i],
    'C++': [/\bc\+\+\b/i, /\bcpp\b/i],
    'Ruby': [/\bruby\b/i, /\bruby on rails\b/i, /\brails\b/i],
    'PHP': [/\bphp\b/i, /\blaravel\b/i],
    'Swift': [/\bswift\b/i, /\bswiftui\b/i]
  },
  frameworks: {
    'React': [/\breact\b/i, /\breactjs\b/i, /\breact\.js\b/i],
    'Next.js': [/\bnext\.js\b/i, /\bnextjs\b/i, /\bnext\b/i],
    'Vue': [/\bvue\b/i, /\bvuejs\b/i, /\bvue\.js\b/i, /\bnuxt\b/i],
    'Angular': [/\bangular\b/i, /\bangularjs\b/i],
    'Node.js': [/\bnode\.js\b/i, /\bnodejs\b/i, /\bnode\b/i, /\bexpress\b/i, /\bexpressjs\b/i],
    'FastAPI': [/\bfastapi\b/i],
    'Django': [/\bdjango\b/i],
    'Spring Boot': [/\bspring boot\b/i, /\bspring-boot\b/i, /\bspring framework\b/i]
  },
  ai_ml: {
    'PyTorch': [/\bpytorch\b/i, /\btorch\b/i],
    'TensorFlow': [/\btensorflow\b/i, /\btf\b/i, /\bkeras\b/i],
    'LangChain': [/\blangchain\b/i, /\blanggraph\b/i],
    'LiteLLM': [/\blitellm\b/i],
    'vLLM': [/\bvllm\b/i],
    'HuggingFace': [/\bhuggingface\b/i, /\bhugging face\b/i, /\bhf transformers\b/i, /\btransformers\b/i],
    'OpenAI': [/\bopenai\b/i, /\bgpt-?4o?\b/i, /\bchatgpt\b/i, /\bgpt-?3\.5\b/i],
    'Vector DBs': [/\bvector db\b/i, /\bvector database\b/i, /\bpinecone\b/i, /\bqdrant\b/i, /\bweaviate\b/i, /\bchromadb?\b/i, /\bmilvus\b/i]
  },
  infra_cloud: {
    'AWS': [/\baws\b/i, /\bamazon web services\b/i, /\bec2\b/i, /\bs3\b/i, /\blambda\b/i],
    'GCP': [/\bgcp\b/i, /\bgoogle cloud\b/i, /\bgoogle cloud platform\b/i, /\bbigquery\b/i],
    'Azure': [/\bazure\b/i, /\bmicrosoft azure\b/i],
    'Docker': [/\bdocker\b/i, /\bcontainerization\b/i, /\bdocker-compose\b/i, /\bcontainers?\b/i],
    'Kubernetes': [/\bkubernetes\b/i, /\bk8s\b/i, /\bhelm\b/i],
    'Terraform': [/\bterraform\b/i, /\btf\b/i, /\biac\b/i],
    'CI/CD': [/\bci\/cd\b/i, /\bcicd\b/i, /\bgithub actions\b/i, /\bgitlab ci\b/i, /\bjenkins\b/i, /\bcircleci\b/i],
    'Kafka': [/\bkafka\b/i, /\bapache kafka\b/i, /\bconfluent\b/i]
  },
  roles: {
    'AI/ML Engineer': [
      /\bai engineer\b/i,
      /\bml engineer\b/i,
      /\bmachine learning engineer\b/i,
      /\bai\/ml\b/i,
      /\bdeep learning\b/i,
      /\bllm engineer\b/i,
      /\bgenai engineer\b/i,
      /\bai researcher\b/i
    ],
    'Data Engineer': [
      /\bdata engineer\b/i,
      /\bdata engineering\b/i,
      /\betl developer\b/i,
      /\betl\b/i,
      /\bdata pipeline\b/i,
      /\banalytics engineer\b/i
    ],
    'DevOps/SRE': [
      /\bdevops\b/i,
      /\bsre\b/i,
      /\bsite reliability\b/i,
      /\bplatform engineer\b/i,
      /\binfrastructure engineer\b/i,
      /\bcloud engineer\b/i
    ],
    'Frontend': [
      /\bfrontend\b/i,
      /\bfront-end\b/i,
      /\bfront end\b/i,
      /\bui engineer\b/i,
      /\bweb developer\b/i
    ],
    'Fullstack': [
      /\bfullstack\b/i,
      /\bfull-stack\b/i,
      /\bfull stack\b/i
    ],
    'Backend': [
      /\bbackend\b/i,
      /\bback-end\b/i,
      /\bback end\b/i,
      /\bserver-side\b/i,
      /\b(?:go|golang|python|rust|java|ruby|node)\s+(?:developer|engineer|dev)\b/i
    ]
  }
};

/**
 * Strips HTML entities, HTML tags, markdown tags, and excess whitespaces
 */
function sanitizeText(input) {
  if (!input || typeof input !== 'string') return '';

  let text = input
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/li>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
    '&mdash;': '—',
    '&ndash;': '–'
  };

  for (const [ent, val] of Object.entries(entities)) {
    text = text.replace(new RegExp(ent, 'gi'), val);
  }

  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));

  // Strip markdown formatting
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/[*_#`~]/g, ' ');

  // Collapse multiple whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes raw salary strings to annual USD full-time equivalent
 */
function normalizeSalary(salaryRaw) {
  if (!salaryRaw || typeof salaryRaw !== 'string') {
    return {
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
      salary_period: null,
      salary_normalized_annual: null
    };
  }

  const raw = salaryRaw.toLowerCase();

  let currencyRate = 1.0;
  let currency = 'USD';
  if (raw.includes('€') || raw.includes('eur')) {
    currencyRate = 1.08;
    currency = 'EUR';
  } else if (raw.includes('£') || raw.includes('gbp')) {
    currencyRate = 1.28;
    currency = 'GBP';
  } else if (raw.includes('cad') || raw.includes('c$')) {
    currencyRate = 0.74;
    currency = 'CAD';
  } else if (raw.includes('aud') || raw.includes('a$')) {
    currencyRate = 0.65;
    currency = 'AUD';
  }

  const isHourly = /\b(?:hr|hour|hourly|\/hr)\b/.test(raw);
  const isMonthly = /\b(?:mo|month|monthly|\/mo)\b/.test(raw);

  const cleanedText = raw.replace(/,/g, '');
  const numRegex = /(\d+(?:\.\d+)?)\s*(k|thousand)?/gi;
  const matches = [];
  let match;

  while ((match = numRegex.exec(cleanedText)) !== null) {
    let val = parseFloat(match[1]);
    if (isNaN(val)) continue;
    if (match[2] && (match[2].toLowerCase() === 'k' || match[2].toLowerCase() === 'thousand')) {
      val *= 1000;
    }
    if (val > 0 && val !== 2024 && val !== 2025 && val !== 2026 && val !== 2027) {
      matches.push(val);
    }
  }

  if (matches.length === 0) {
    return {
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
      salary_period: null,
      salary_normalized_annual: null
    };
  }

  let min = Math.min(...matches);
  let max = Math.max(...matches);

  if (min > 30 && min < 1000 && !isHourly) {
    min *= 1000;
    max *= 1000;
  }

  let annualMin = min;
  let annualMax = max;

  if (isHourly) {
    annualMin = min * 2080;
    annualMax = max * 2080;
  } else if (isMonthly) {
    annualMin = min * 12;
    annualMax = max * 12;
  }

  const normalizedAnnualMin = Math.round(annualMin * currencyRate);
  const normalizedAnnualMax = Math.round(annualMax * currencyRate);
  const medianAnnual = Math.round((normalizedAnnualMin + normalizedAnnualMax) / 2);

  return {
    salary_min: normalizedAnnualMin,
    salary_max: normalizedAnnualMax,
    salary_currency: 'USD',
    salary_period: 'year',
    salary_normalized_annual: medianAnnual
  };
}

/**
 * Matches skills and infers primary role using strict bounded regex patterns
 */
function extractTokens(description, title = '') {
  const combinedText = `${title} ${description}`;

  const matchCategory = (categoryMap) => {
    const found = [];
    for (const [skillName, regexList] of Object.entries(categoryMap)) {
      const isMatch = regexList.some((regex) => regex.test(combinedText));
      if (isMatch) {
        found.push(skillName);
      }
    }
    return found;
  };

  const languages_found = matchCategory(TAXONOMY_PATTERNS.languages);
  const frameworks_found = matchCategory(TAXONOMY_PATTERNS.frameworks);
  const ai_ml_found = matchCategory(TAXONOMY_PATTERNS.ai_ml);
  const cloud_found = matchCategory(TAXONOMY_PATTERNS.infra_cloud);

  // Inferred Primary Role
  let primary_role = 'Backend'; // Default baseline role

  // Priority 1: Match directly from title
  let roleMatched = false;
  for (const [roleName, regexList] of Object.entries(TAXONOMY_PATTERNS.roles)) {
    if (regexList.some((r) => r.test(title))) {
      primary_role = roleName;
      roleMatched = true;
      break;
    }
  }

  // Priority 2: Match from description role patterns if title didn't resolve
  if (!roleMatched) {
    for (const [roleName, regexList] of Object.entries(TAXONOMY_PATTERNS.roles)) {
      if (regexList.some((r) => r.test(description))) {
        primary_role = roleName;
        roleMatched = true;
        break;
      }
    }
  }

  // Priority 3: Heuristic based on detected skills
  if (!roleMatched) {
    if (ai_ml_found.length > 0) {
      primary_role = 'AI/ML Engineer';
    } else if (cloud_found.includes('Kubernetes') || cloud_found.includes('Terraform') || cloud_found.includes('CI/CD')) {
      primary_role = languages_found.length > 0 ? 'Backend' : 'DevOps/SRE';
    } else if (frameworks_found.includes('React') || frameworks_found.includes('Vue') || frameworks_found.includes('Angular')) {
      primary_role = (languages_found.includes('Go') || languages_found.includes('Python') || languages_found.includes('Java')) ? 'Fullstack' : 'Frontend';
    } else if (languages_found.includes('Go') || languages_found.includes('Rust') || languages_found.includes('Python') || languages_found.includes('Java')) {
      primary_role = 'Backend';
    }
  }

  return {
    languages_found,
    frameworks_found,
    ai_ml_found,
    cloud_found,
    primary_role
  };
}

/**
 * Deduplicates jobs using SHA-256 hash of normalized title and company
 */
function deduplicateJobs(jobs) {
  const seenHashes = new Set();
  const uniqueJobs = [];

  for (const job of jobs) {
    const rawKey = `${(job.title || '').toLowerCase().trim()}::${(job.company || '').toLowerCase().trim()}`;
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    if (!seenHashes.has(hash)) {
      seenHashes.add(hash);
      uniqueJobs.push({ ...job, dedupe_hash: hash });
    }
  }

  return uniqueJobs;
}

/**
 * Complete cleaning & enrichment pipeline for a single job
 */
function cleanAndEnrichJob(job) {
  const sanitizedTitle = sanitizeText(job.title);
  const sanitizedDesc = sanitizeText(job.description);
  const salaryData = normalizeSalary(job.salary_raw);
  const tokenData = extractTokens(sanitizedDesc, sanitizedTitle);

  return {
    id: job.id,
    title: sanitizedTitle,
    company: sanitizeText(job.company),
    description: sanitizedDesc,
    url: job.url,
    published_at: job.published_at,
    salary_raw: job.salary_raw,
    salary_min: salaryData.salary_min,
    salary_max: salaryData.salary_max,
    salary_currency: salaryData.salary_currency,
    salary_period: salaryData.salary_period,
    salary_normalized_annual: salaryData.salary_normalized_annual,
    source: job.source,
    languages_found: tokenData.languages_found,
    frameworks_found: tokenData.frameworks_found,
    ai_ml_found: tokenData.ai_ml_found,
    cloud_found: tokenData.cloud_found,
    primary_role: tokenData.primary_role
  };
}

module.exports = {
  TAXONOMY_PATTERNS,
  sanitizeText,
  normalizeSalary,
  extractTokens,
  deduplicateJobs,
  cleanAndEnrichJob
};
