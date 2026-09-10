const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { cleanAndEnrichJob, deduplicateJobs } = require('../scripts/extractor');
const { generatePdf } = require('../scripts/generate_pdf');

test('E2E Pipeline - Mock Mode Execution & Artifact Verification', async () => {
  // Step 1: Ingest & Cleanse Mock Jobs
  const mockPath = path.resolve('test/mock_jobs.json');
  assert.ok(fs.existsSync(mockPath), 'Expected test/mock_jobs.json to exist');
  const rawJobs = JSON.parse(fs.readFileSync(mockPath, 'utf8'));

  const dedupedJobs = deduplicateJobs(rawJobs);
  const enrichedJobs = dedupedJobs.map(cleanAndEnrichJob);
  assert.ok(enrichedJobs.length > 0, 'Expected enriched jobs');

  // Step 2: Save to data/latest_jobs.json
  const latestJobsPath = path.resolve('data/latest_jobs.json');
  fs.writeFileSync(latestJobsPath, JSON.stringify(enrichedJobs, null, 2), 'utf8');
  assert.ok(fs.existsSync(latestJobsPath), 'Expected data/latest_jobs.json to be written');

  // Step 3: Run Statistical Aggregation Engine
  const pyOutput = execSync('python scripts/aggregate_metrics.py', { encoding: 'utf8' });
  assert.ok(pyOutput.includes('[SUCCESS] Wrote metrics'), 'Expected Python aggregator success output');

  const trendMetricsPath = path.resolve('data/trend_metrics.json');
  assert.ok(fs.existsSync(trendMetricsPath), 'Expected data/trend_metrics.json to exist');

  const metrics = JSON.parse(fs.readFileSync(trendMetricsPath, 'utf8'));
  assert.equal(metrics.total_jobs, enrichedJobs.length);
  assert.ok(metrics.skills_breakdown.length > 0);

  // Step 4: Verify README Updated
  const readmePath = path.resolve('README.md');
  const readmeContent = fs.readFileSync(readmePath, 'utf8');
  assert.ok(readmeContent.includes('<!-- MARKET_TABLE_START -->'));
  assert.ok(readmeContent.includes('<!-- ROLE_TABLE_START -->'));

  // Step 5: Run PDF Generator
  await generatePdf();
  const pdfPath = path.resolve('reports/latest_market_report.pdf');
  assert.ok(fs.existsSync(pdfPath), 'Expected reports/latest_market_report.pdf to exist');
  const pdfStats = fs.statSync(pdfPath);
  assert.ok(pdfStats.size > 20000, `Expected PDF size > 20KB, got ${pdfStats.size}`);

  console.log('[TEST] Verified all 4 core pipeline artifacts generated successfully.');
});
