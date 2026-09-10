const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildHtml, generatePdf } = require('../scripts/generate_pdf');

test('PDF Generation - Template Hydration & Placeholders', () => {
  const metricsPath = path.resolve('data/trend_metrics.json');
  assert.ok(fs.existsSync(metricsPath), 'Expected data/trend_metrics.json to exist');
  const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));

  const templatePath = path.resolve('templates/report_template.html');
  assert.ok(fs.existsSync(templatePath), 'Expected templates/report_template.html to exist');
  const templateHtml = fs.readFileSync(templatePath, 'utf8');

  const hydratedHtml = buildHtml(metrics, templateHtml);

  // Assert no leftover unhydrated placeholders
  const leftoverPlaceholders = hydratedHtml.match(/\{\{[A-Z_]+\}\}/g);
  assert.equal(
    leftoverPlaceholders,
    null,
    `Found unhydrated placeholders: ${leftoverPlaceholders ? leftoverPlaceholders.join(', ') : ''}`
  );

  // Assert key elements are present in output
  assert.ok(hydratedHtml.includes('Dominant Language'), 'Expected "Dominant Language" in HTML');
  assert.ok(hydratedHtml.includes('Fastest Growing'), 'Expected "Fastest Growing" in HTML');
  assert.ok(hydratedHtml.includes('AI &amp; Agentic Stack Momentum') || hydratedHtml.includes('AI & Agentic Stack Momentum'), 'Expected AI spotlight in HTML');
  assert.ok(hydratedHtml.includes('bar-lang'), 'Expected language progress bars in HTML');
  assert.ok(hydratedHtml.includes('bar-fw'), 'Expected framework progress bars in HTML');
  assert.ok(hydratedHtml.includes('salary-highlight'), 'Expected salary table in HTML');
});

test('PDF Generation - Export to PDF Artifact', async () => {
  const pdfPath = path.resolve('reports/latest_market_report.pdf');
  await generatePdf();

  assert.ok(fs.existsSync(pdfPath), 'Expected reports/latest_market_report.pdf to exist');
  const stats = fs.statSync(pdfPath);
  assert.ok(stats.size > 20000, `Expected PDF size to be > 20KB, got ${stats.size} bytes`);
});
