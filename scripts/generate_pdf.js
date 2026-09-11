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

  // Median Salary & Quartiles (Explicitly enforce 'en-US' locale for standard international grouping)
  const salStats = metrics.overall_salary_stats || {};
  const medianSalStr = salStats.median ? `$${Math.round(salStats.median).toLocaleString('en-US')}` : 'N/A';
  let quartileRangeStr = 'Full-time Normalized (USD)';
  if (salStats.p25 && salStats.p75) {
    quartileRangeStr = `$${Math.round(salStats.p25 / 1000)}k - $${Math.round(salStats.p75 / 1000)}k (IQR)`;
  }

  // Languages Horizontal Bars (Top 5 active)
  const activeLanguages = langSkills.filter(l => l.count > 0);
  const topLanguages = (activeLanguages.length > 0 ? activeLanguages : langSkills).slice(0, 5);
  const maxLangShare = topLanguages.length > 0 ? Math.max(...topLanguages.map(l => l.share_pct), 1) : 100;
  const langBarsHtml = topLanguages.map(l => {
    const barWidth = Math.max(Math.round((l.share_pct / maxLangShare) * 100), 8);
    const jobUnit = l.count === 1 ? 'job' : 'jobs';
    return `
      <div class="progress-item">
        <div class="progress-header">
          <span>${l.skill}</span>
          <span class="progress-meta">${l.count} ${jobUnit} (${l.share_pct.toFixed(1)}%)</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill bar-lang" style="width: ${barWidth}%;"></div>
        </div>
      </div>`;
  }).join('\n') || '<div class="progress-item">No language data recorded</div>';

  // Frameworks Horizontal Bars (Top 5 active)
  const fwSkills = (metrics.skills_breakdown || []).filter(s => s.category === 'frameworks');
  fwSkills.sort((a, b) => b.count - a.count);
  const activeFrameworks = fwSkills.filter(f => f.count > 0);
  const topFrameworks = (activeFrameworks.length > 0 ? activeFrameworks : fwSkills).slice(0, 5);
  const maxFwShare = topFrameworks.length > 0 ? Math.max(...topFrameworks.map(f => f.share_pct), 1) : 100;
  const fwBarsHtml = topFrameworks.map(f => {
    const barWidth = Math.max(Math.round((f.share_pct / maxFwShare) * 100), 8);
    const jobUnit = f.count === 1 ? 'job' : 'jobs';
    return `
      <div class="progress-item">
        <div class="progress-header">
          <span>${f.skill}</span>
          <span class="progress-meta">${f.count} ${jobUnit} (${f.share_pct.toFixed(1)}%)</span>
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
      const postingUnit = s.count === 1 ? 'posting' : 'postings';
      return `
        <div class="spotlight-card">
          <div class="spotlight-tech">${s.skill}</div>
          <div class="spotlight-metric">${s.share_pct.toFixed(1)}%</div>
          <div class="spotlight-sub">${s.count} ${postingUnit} (${deltaSign}${s.delta_momentum.toFixed(1)}% Δ)</div>
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
        const postingUnit = s.count === 1 ? 'posting' : 'postings';
        spotlightCards.push(`
          <div class="spotlight-card">
            <div class="spotlight-tech">${s.skill}</div>
            <div class="spotlight-metric">${s.share_pct.toFixed(1)}%</div>
            <div class="spotlight-sub">${s.count} ${postingUnit} (${deltaSign}${s.delta_momentum.toFixed(1)}% Δ)</div>
          </div>`);
      }
    }
  }

  const spotlightHtml = spotlightCards.join('\n') || '<div class="spotlight-card"><div class="spotlight-tech">AI Stack Active</div></div>';

  // Salary Arbitrage Table Rows (Enforce 'en-US' locale for consistent USD numbers)
  const salaryRowsHtml = (metrics.roles_breakdown || []).map(r => {
    const stats = r.salary_stats || {};
    const p25Str = stats.p25 ? `$${Math.round(stats.p25).toLocaleString('en-US')}` : '—';
    const medStr = stats.median ? `$${Math.round(stats.median).toLocaleString('en-US')}` : '—';
    const p75Str = stats.p75 ? `$${Math.round(stats.p75).toLocaleString('en-US')}` : '—';
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
      waitUntil: 'domcontentloaded',
      timeout: 15000
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

    // 1. Save dated archive copy: reports/archive/market_report_YYYY-MM-DD.pdf
    const dateStr = (metrics.generated_at ? metrics.generated_at.split('T')[0] : new Date().toISOString().split('T')[0]);
    const archiveDir = path.join(REPORTS_DIR, 'archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    const archivePdfPath = path.join(archiveDir, `market_report_${dateStr}.pdf`);
    fs.copyFileSync(OUTPUT_PDF_PATH, archivePdfPath);
    console.log(`[INFO] Archived daily report copy to: ${archivePdfPath}`);

    // 2. Update reports/reports_index.json (rolling registry of latest reports)
    const reportsIndexPath = path.join(REPORTS_DIR, 'reports_index.json');
    let reportsIndex = [];
    if (fs.existsSync(reportsIndexPath)) {
      try {
        reportsIndex = JSON.parse(fs.readFileSync(reportsIndexPath, 'utf8'));
      } catch (e) {}
    }

    const topSkill = (metrics.top_in_demand && metrics.top_in_demand[0]) ? metrics.top_in_demand[0].skill : 'N/A';
    const medSalary = (metrics.overall_salary_stats && metrics.overall_salary_stats.median) ? `$${Math.round(metrics.overall_salary_stats.median).toLocaleString('en-US')}` : 'N/A';

    const reportEntry = {
      date: dateStr,
      title: `Executive Market Brief (${dateStr})`,
      archive_path: `reports/archive/market_report_${dateStr}.pdf`,
      latest_link: `reports/latest_market_report.pdf`,
      total_jobs: metrics.total_jobs || 0,
      top_skill: topSkill,
      median_salary: medSalary
    };

    const existingIdx = reportsIndex.findIndex(r => r.date === dateStr);
    if (existingIdx >= 0) {
      reportsIndex[existingIdx] = reportEntry;
    } else {
      reportsIndex.unshift(reportEntry);
    }

    // Keep sorted by date descending, max 30 entries in JSON registry
    reportsIndex.sort((a, b) => b.date.localeCompare(a.date));
    reportsIndex = reportsIndex.slice(0, 30);
    fs.writeFileSync(reportsIndexPath, JSON.stringify(reportsIndex, null, 2), 'utf8');

    // 3. Update README.md with the top 10 reports table
    updateReadmeReportsTable(reportsIndex);
  } finally {
    await browser.close();
  }
}

/**
 * Injects or updates the top 10 reports table in README.md
 */
function updateReadmeReportsTable(reportsIndex) {
  const readmePath = path.join(ROOT_DIR, 'README.md');
  if (!fs.existsSync(readmePath)) return;

  const top10 = reportsIndex.slice(0, 10);
  const rows = [
    '| Date | Executive Report | Analyzed Postings | Top In-Demand Skill | Median Salary | Direct PDF Link |',
    '| :--- | :--- | :---: | :--- | :---: | :---: |'
  ];

  for (let i = 0; i < top10.length; i++) {
    const r = top10[i];
    const isLatest = (i === 0);
    const badge = isLatest ? ' `Latest`' : '';
    const pdfLink = isLatest ? r.latest_link : r.archive_path;
    rows.push(
      `| **${r.date}** | ${r.title}${badge} | ${r.total_jobs} | \`${r.top_skill}\` | ${r.median_salary} | [View / Download PDF](${pdfLink}) |`
    );
  }

  const tableMd = rows.join('\n');
  let readme = fs.readFileSync(readmePath, 'utf8');

  const startMarker = '<!-- REPORTS_TABLE_START -->';
  const endMarker = '<!-- REPORTS_TABLE_END -->';

  if (readme.includes(startMarker) && readme.includes(endMarker)) {
    const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g');
    readme = readme.replace(regex, `${startMarker}\n${tableMd}\n${endMarker}`);
  } else {
    // Insert section right before ## Live Market Highlights
    const insertPoint = '## Live Market Highlights';
    const sectionMd = `## Recent Executive PDF Reports (Last 10 Days)\n\n> 📥 **[Download Latest Executive PDF Brief](reports/latest_market_report.pdf)**\n\n${startMarker}\n${tableMd}\n${endMarker}\n\n---\n\n`;
    if (readme.includes(insertPoint)) {
      readme = readme.replace(insertPoint, sectionMd + insertPoint);
    } else {
      readme += `\n\n${sectionMd}`;
    }
  }

  fs.writeFileSync(readmePath, readme, 'utf8');
  console.log('[SUCCESS] Updated README.md with recent reports table (capped at 10)');
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
