const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeText,
  normalizeSalary,
  extractTokens,
  deduplicateJobs,
  cleanAndEnrichJob
} = require('../scripts/extractor');

test('Token Extraction - Required Prompt Spec: Senior Go Developer with PyTorch and Kubernetes', () => {
  const text = 'Seeking a Senior Go Developer with PyTorch and Kubernetes experience';
  const tokens = extractTokens(text, text);

  // Exact extraction assertions
  assert.deepEqual(tokens.languages_found, ['Go'], 'Expected exactly [Go] in languages_found');
  assert.deepEqual(tokens.ai_ml_found, ['PyTorch'], 'Expected exactly [PyTorch] in ai_ml_found');
  assert.deepEqual(tokens.cloud_found, ['Kubernetes'], 'Expected exactly [Kubernetes] in cloud_found');
  assert.deepEqual(tokens.frameworks_found, [], 'Expected empty frameworks_found');

  // Role must be classified as Backend or AI/ML Engineer
  const validRoles = ['Backend', 'AI/ML Engineer'];
  assert.ok(
    validRoles.includes(tokens.primary_role),
    `Expected primary_role to be one of ${validRoles.join(', ')}, but got "${tokens.primary_role}"`
  );
});

test('Token Extraction - False Positive Prevention (Word Boundaries)', () => {
  // Test 1: 'Django' and 'Good' must not trigger 'Go'
  const djangoText = 'We use Django for backend services and require Good communication skills.';
  const djangoTokens = extractTokens(djangoText);
  assert.ok(
    !djangoTokens.languages_found.includes('Go'),
    'False positive: "Go" was mistakenly matched in "Django" or "Good"'
  );
  assert.ok(
    djangoTokens.frameworks_found.includes('Django'),
    'Expected "Django" to be extracted in frameworks_found'
  );

  // Test 2: 'Trust' must not trigger 'Rust'
  const trustText = 'Our company culture is built on Trust, honesty, and mutual respect.';
  const trustTokens = extractTokens(trustText);
  assert.ok(
    !trustTokens.languages_found.includes('Rust'),
    'False positive: "Rust" was mistakenly matched in "Trust"'
  );

  // Test 3: Standalone 'Rust' works properly
  const rustText = 'Developing high-throughput microservices in Rust and Docker.';
  const rustTokens = extractTokens(rustText);
  assert.ok(
    rustTokens.languages_found.includes('Rust'),
    'Expected "Rust" to be matched when standalone'
  );
  assert.ok(
    rustTokens.cloud_found.includes('Docker'),
    'Expected "Docker" to be matched in cloud_found'
  );
});

test('Salary Normalization - Handles various standard formats', () => {
  // Range with k
  const rangeK = normalizeSalary('$120k - $150k');
  assert.equal(rangeK.salary_min, 120000);
  assert.equal(rangeK.salary_max, 150000);
  assert.equal(rangeK.salary_normalized_annual, 135000);
  assert.equal(rangeK.salary_currency, 'USD');

  // Euro annual salary
  const euroSalary = normalizeSalary('€80,000/yr');
  assert.equal(euroSalary.salary_normalized_annual, 86400); // 80000 * 1.08

  // Hourly single rate (multiplied to 2080 hours)
  const hourlySingle = normalizeSalary('$60/hr');
  assert.equal(hourlySingle.salary_normalized_annual, 124800); // 60 * 2080

  // Hourly range
  const hourlyRange = normalizeSalary('$50 - $75 per hour');
  assert.equal(hourlyRange.salary_min, 104000); // 50 * 2080
  assert.equal(hourlyRange.salary_max, 156000); // 75 * 2080
  assert.equal(hourlyRange.salary_normalized_annual, 130000);

  // Null or non-salary string
  const competitive = normalizeSalary('Competitive salary + equity');
  assert.equal(competitive.salary_normalized_annual, null);
});

test('Sanitization - Strips HTML tags, entities, and markdown', () => {
  const rawHtml = '<p>We are looking for a <strong>Senior Engineer</strong> &amp; Architect.<br>Experience with [React](https://react.dev) &nbsp;is required.</p>';
  const sanitized = sanitizeText(rawHtml);
  assert.equal(
    sanitized,
    'We are looking for a Senior Engineer & Architect. Experience with React is required.'
  );
});

test('Deduplication - Eliminates duplicate jobs by title and company hash', () => {
  const jobs = [
    { title: 'Senior Backend Engineer', company: 'Acme Corp', id: '1' },
    { title: 'senior backend engineer ', company: ' Acme Corp', id: '2' },
    { title: 'Frontend Developer', company: 'Acme Corp', id: '3' }
  ];

  const deduped = deduplicateJobs(jobs);
  assert.equal(deduped.length, 2, 'Expected 2 unique jobs after deduplication');
  assert.equal(deduped[0].id, '1');
  assert.equal(deduped[1].id, '3');
});

test('End-to-End Job Enrichment', () => {
  const rawJob = {
    id: 'test-101',
    title: 'Senior AI Engineer',
    company: 'Neural Labs',
    description: '<p>Seeking an experienced <strong>AI Engineer</strong> skilled in <strong>Python</strong>, <strong>PyTorch</strong>, <strong>LangChain</strong>, and <strong>AWS</strong>.</p>',
    url: 'https://example.com/job/101',
    published_at: '2026-03-09T12:00:00.000Z',
    salary_raw: '$160k - $200k',
    source: 'arbeitnow'
  };

  const enriched = cleanAndEnrichJob(rawJob);

  assert.equal(enriched.title, 'Senior AI Engineer');
  assert.equal(enriched.company, 'Neural Labs');
  assert.equal(enriched.salary_normalized_annual, 180000);
  assert.equal(enriched.primary_role, 'AI/ML Engineer');
  assert.deepEqual(enriched.languages_found, ['Python']);
  assert.ok(enriched.ai_ml_found.includes('PyTorch'));
  assert.ok(enriched.ai_ml_found.includes('LangChain'));
  assert.ok(enriched.cloud_found.includes('AWS'));
});
