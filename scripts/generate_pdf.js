#!/usr/bin/env node
/**
 * Publication-Ready Executive PDF Report Generator
 * Powered by Puppeteer.
 * Reads data/trend_metrics.json, hydrates templates/report_template.html,
 * and exports to reports/latest_market_report.pdf.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const METRICS_PATH = path.join(ROOT_DIR, 'data', 'trend_metrics.json');
const TEMPLATE_PATH = path.join(ROOT_DIR, 'templates', 'report_template.html');
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');
const OUTPUT_PDF_PATH = path.join(REPORTS_DIR, 'latest_market_report.pdf');

/**
 * Retrieves the current git commit short SHA
 */
function getCommitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
  } catch (e) {
    return 'snapshot';
  }
}

/**
 * Finds available Chrome / Chromium / Edge executable for local or CI execution
 */
function findSystemBrowser() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidatePaths = [
    // Windows Chrome & Edge
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    // Linux Chromium & Chrome
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    // MacOS Chrome
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return undefined;
}

/**
 * Hydrates the HTML template with calculated metrics data
 */
function buildHtml(metrics, templateHtml) {
  const commitSha = getCommitSha();
  const totalJobs = metrics.total_jobs || 0;

  // Format date
  const genDate = metrics.generated_at
    ? metrics.generated_at.substring(0, 16).replace('T', ' ') + ' UTC'
    : new Date().toISOString().substring(0, 16).replace('T', ' ') + ' UTC';

  // Dominant Language
  const langSkills = (metrics.skills_breakdown || []).filter(s => s.category === 'languages');
  langSkills.sort((a, b) => b.count - a.count);
  const dominantLang = langSkills[0] || { skill: 'N/A', share_pct: 0 };

  // Fastest Growing Skill
  const fastestGrowing = (metrics.top_fastest_growing || [])[0] || { skill: 'N/A', delta_momentum: 0 };
  const momentumStr = (fastestGrowing.delta_momentum >= 0 ? '+' : '') + fastestGrowing.delta_momentum.toFixed(1) + '%';

  // Median Salary & Quartiles
  const salStats = metrics.overall_salary_stats || {};
  const medianSalStr = salStats.median ? `$${Math.round(salStats.median).toLocaleString()}` : 'N/A';
  let quartileRangeStr = 'Full-time Normalized (USD)';
  if (salStats.p25 && salStats.p75) {
    quartileRangeStr = `$${Math.round(salStats.p25 / 1000)}k - $${Math.round(salStats.p75 / 1000)}k (IQR)`;
  }

  // Languages Horizontal Bars (Top 5)
  const topLanguages = langSkills.slice(0, 5);
  const maxLangShare = topLanguages.length > 0 ? Math.max(...topLanguages.map(l => l.share_pct), 1) : 100;
  const langBarsHtml = topLanguages.map(l => {
    const barWidth = Math.max(Math.round((l.share_pct / maxLangShare) * 100), 8);
    return `
      <div class="progress-item">
        <div class="progress-header">
          <span>${l.skill}</span>
          <span class="progress-meta">${l.count} jobs (${l.share_pct.toFixed(1)}%)</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill bar-lang" style="width: ${barWidth}%;"></div>
        </div>
      </div>`;
  }).join('\n') || '<div class="progress-item">No language data recorded</div>';

  // Frameworks Horizontal Bars (Top 5)
  const fwSkills = (metrics.skills_breakdown || []).filter(s => s.category === 'frameworks');
  fwSkills.sort((a, b) => b.count - a.count);
  const topFrameworks = fwSkills.slice(0, 5);
  const maxFwShare = topFrameworks.length > 0 ? Math.max(...topFrameworks.map(f => f.share_pct), 1) : 100;
  const fwBarsHtml = topFrameworks.map(f => {
    const barWidth = Math.max(Math.round((f.share_pct / maxFwShare) * 100), 8);
    return `
      <div class="progress-item">
        <div class="progress-header">
          <span>${f.skill}</span>
          <span class="progress-meta">${f.count} jobs (${f.share_pct.toFixed(1)}%)</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill bar-fw" style="width: ${barWidth}%;"></div>
        </div>
      </div>`;
  }).join('\n') || '<div class="progress-item">No framework data recorded</div>';

  // AI & LLM Spotlight Cards (LangChain, vLLM, LiteLLM, Vector DBs, PyTorch, OpenAI)
  const targetAiSkills = ['LangChain', 'vLLM', 'LiteLLM', 'Vector DBs', 'PyTorch', 'OpenAI', 'HuggingFace'];
  const allSkillsMap = {};
  for (const s of (metrics.skills_breakdown || [])) {
    allSkillsMap[s.skill] = s;
  }

  const spotlightCards = targetAiSkills
    .filter(name => allSkillsMap[name])
    .slice(0, 4) // Show top 4 key spotlight cards
    .map(name => {
      const s = allSkillsMap[name];
      const deltaSign = s.delta_momentum >= 0 ? '+' : '';
      return `
        <div class="spotlight-card">
          <div class="spotlight-tech">${s.skill}</div>
          <div class="spotlight-metric">${s.share_pct.toFixed(1)}%</div>
          <div class="spotlight-sub">${s.count} postings (${deltaSign}${s.delta_momentum.toFixed(1)}% Δ)</div>
        </div>`;
    });

  // Fallback if some AI skills have 0 postings yet
  if (spotlightCards.length < 4) {
    const generalAi = (metrics.skills_breakdown || [])
      .filter(s => s.category === 'ai_ml')
      .slice(0, 4);
    for (const s of generalAi) {
      if (!spotlightCards.some(card => card.includes(s.skill)) && spotlightCards.length < 4) {
        const deltaSign = s.delta_momentum >= 0 ? '+' : '';
        spotlightCards.push(`
          <div class="spotlight-card">
            <div class="spotlight-tech">${s.skill}</div>
            <div class="spotlight-metric">${s.share_pct.toFixed(1)}%</div>
            <div class="spotlight-sub">${s.count} postings (${deltaSign}${s.delta_momentum.toFixed(1)}% Δ)</div>
          </div>`);
      }
    }
  }

  const spotlightHtml = spotlightCards.join('\n') || '<div class="spotlight-card"><div class="spotlight-tech">AI Stack Active</div></div>';

  // Salary Arbitrage Table Rows
  const salaryRowsHtml = (metrics.roles_breakdown || []).map(r => {
    const stats = r.salary_stats || {};
    const p25Str = stats.p25 ? `$${Math.round(stats.p25).toLocaleString()}` : '—';
    const medStr = stats.median ? `$${Math.round(stats.median).toLocaleString()}` : '—';
    const p75Str = stats.p75 ? `$${Math.round(stats.p75).toLocaleString()}` : '—';
    return `
      <tr>
        <td><strong>${r.role}</strong></td>
        <td>${r.share_pct.toFixed(1)}% (${r.job_count})</td>
        <td class="salary-highlight">${p25Str}</td>
        <td class="salary-highlight">${medStr}</td>
        <td class="salary-highlight">${p75Str}</td>
        <td><span class="ai-pill">${r.ai_penetration_pct.toFixed(1)}% AI</span></td>
      </tr>`;
  }).join('\n');

  // Replace placeholders
  let html = templateHtml
    .replace(/\{\{GENERATED_AT\}\}/g, genDate)
    .replace(/\{\{TOTAL_JOBS\}\}/g, totalJobs.toString())
    .replace(/\{\{DOMINANT_LANGUAGE\}\}/g, dominantLang.skill)
    .replace(/\{\{DOMINANT_LANG_SHARE\}\}/g, `${dominantLang.share_pct.toFixed(1)}%`)
    .replace(/\{\{FASTEST_GROWING\}\}/g, fastestGrowing.skill)
    .replace(/\{\{FASTEST_GROWING_MOMENTUM\}\}/g, momentumStr)
    .replace(/\{\{MEDIAN_SALARY\}\}/g, medianSalStr)
    .replace(/\{\{SALARY_QUARTILE_RANGE\}\}/g, quartileRangeStr)
    .replace(/\{\{LANGUAGES_BARS\}\}/g, langBarsHtml)
    .replace(/\{\{FRAMEWORKS_BARS\}\}/g, fwBarsHtml)
    .replace(/\{\{AI_SPOTLIGHT_CARDS\}\}/g, spotlightHtml)
    .replace(/\{\{SALARY_TABLE_ROWS\}\}/g, salaryRowsHtml)
    .replace(/\{\{COMMIT_SHA\}\}/g, commitSha);

  return html;
}

/**
 * Main PDF Generation Routine
 */
async function generatePdf() {
  console.log('[INFO] Loading metrics data from:', METRICS_PATH);
  if (!fs.existsSync(METRICS_PATH)) {
    throw new Error(`Metrics file not found: ${METRICS_PATH}. Please run aggregate_metrics.py first.`);
  }
  const metrics = JSON.parse(fs.readFileSync(METRICS_PATH, 'utf8'));

  console.log('[INFO] Loading HTML template from:', TEMPLATE_PATH);
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`Report template not found: ${TEMPLATE_PATH}`);
  }
  const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // Hydrate template
  const finalHtml = buildHtml(metrics, templateHtml);

  // Ensure output directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (err) {
    console.warn('[WARN] Standard puppeteer package not resolved, attempting puppeteer-core...');
    puppeteer = require('puppeteer-core');
  }

  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
      '--no-first-run'
    ]
  };

  const systemBrowser = findSystemBrowser();
  if (systemBrowser) {
    launchOptions.executablePath = systemBrowser;
    console.log('[INFO] Using browser executable at:', systemBrowser);
  }

  console.log('[INFO] Launching Chromium browser...');
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    console.log('[INFO] Setting page content...');
    await page.setContent(finalHtml, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 30000
    });

    console.log('[INFO] Generating publication-ready vector PDF...');
    await page.pdf({
      path: OUTPUT_PDF_PATH,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '12mm',
        right: '12mm'
      },
      preferCSSPageSize: true
    });

    console.log(`[SUCCESS] Executive report generated successfully: ${OUTPUT_PDF_PATH}`);
    const stats = fs.statSync(OUTPUT_PDF_PATH);
    console.log(`[INFO] PDF file size: ${(stats.size / 1024).toFixed(1)} KB`);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  generatePdf().catch(err => {
    console.error('[ERROR] Failed to generate PDF report:', err);
    process.exit(1);
  });
}

module.exports = {
  buildHtml,
  generatePdf,
  findSystemBrowser,
  getCommitSha
};
