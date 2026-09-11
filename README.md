# Tech Job Market & Skill Arbitrage Monitor

> **Zero-server, autonomous analytics pipeline** powered by headless **n8n**, Node.js/Python, and GitHub Actions. Ingests remote tech postings, performs bounded regex token extraction, computes skill velocity ("Boom Index"), indexes compensation percentiles, and publishes live market artifacts directly to this repository.

[![Analytics Pipeline](https://github.com/shivenpatro/n8n-job_priority_tracker/actions/workflows/daily_analytics.yml/badge.svg)](https://github.com/shivenpatro/n8n-job_priority_tracker/actions)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Runtime](https://img.shields.io/badge/n8n-headless%20CLI-EA4B71.svg)
![Python](https://img.shields.io/badge/Python-3.11-3776AB.svg)
![Last Run](https://img.shields.io/badge/Last%20Run-2026-09-11%2009:23:26%20UTC-blue)

---

## Recent Executive PDF Reports (Last 10 Days)

> [Download Latest Executive PDF Brief](reports/latest_market_report.pdf)

<!-- REPORTS_TABLE_START -->
| Date | Executive Report | Analyzed Postings | Top In-Demand Skill | Median Salary | Direct PDF Link |
| :--- | :--- | :---: | :--- | :---: | :---: |
| **2026-09-11** | Executive Market Brief (2026-09-11) `Latest` | 6 | `Docker` | $152,500 | [View / Download PDF](reports/latest_market_report.pdf) |
<!-- REPORTS_TABLE_END -->

---

## Live Market Highlights (Latest Run: `2026-09-11 09:23:26 UTC`)

| Total Jobs Ingested | Postings with Salary | Market Median Salary | Active Categories |
| :---: | :---: | :---: | :---: |
| **6** | **4** | **$152,500** | **Languages, Frameworks, AI/ML, Cloud** |

<br/>

### Top 10 Trending Technologies

<!-- MARKET_TABLE_START -->
| Rank | Skill | Category | Frequency | Market Share | Momentum (Δ) | Median Salary (USD) | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | **Docker** | `infra_cloud` | 4 | 66.7% | 0.0% | $162,500 | High Demand |
| 2 | **Python** | `languages` | 3 | 50.0% | 0.0% | $142,500 | High Demand |
| 3 | **AWS** | `infra_cloud` | 3 | 50.0% | 0.0% | $152,500 | High Demand |
| 4 | **TypeScript** | `languages` | 2 | 33.3% | 0.0% | $138,750 | Steady |
| 5 | **JavaScript** | `languages` | 2 | 33.3% | 0.0% | $138,750 | Steady |
| 6 | **React** | `frameworks` | 2 | 33.3% | 0.0% | $138,750 | Steady |
| 7 | **Next.js** | `frameworks` | 2 | 33.3% | 0.0% | $138,750 | Steady |
| 8 | **CI/CD** | `infra_cloud` | 2 | 33.3% | 0.0% | $162,500 | Steady |
| 9 | **Kafka** | `infra_cloud` | 2 | 33.3% | 0.0% | $142,500 | Steady |
| 10 | **Rust** | `languages` | 1 | 16.7% | 0.0% | $190,000 | Steady |
<!-- MARKET_TABLE_END -->

<br/>

<div align="center">
<table>
<tr>
<td width="50%" valign="top">

### Top 5 Fastest Growing (Boom Index $\Delta$)
- **Docker** (`infra_cloud`): +0.0% share (4 postings)
- **Python** (`languages`): +0.0% share (3 postings)
- **AWS** (`infra_cloud`): +0.0% share (3 postings)
- **TypeScript** (`languages`): +0.0% share (2 postings)
- **JavaScript** (`languages`): +0.0% share (2 postings)

</td>
<td width="50%" valign="top">

### Top 5 Most In-Demand Skills
- **Docker** (`infra_cloud`): 4 postings (66.7% market penetration)
- **Python** (`languages`): 3 postings (50.0% market penetration)
- **AWS** (`infra_cloud`): 3 postings (50.0% market penetration)
- **TypeScript** (`languages`): 2 postings (33.3% market penetration)
- **JavaScript** (`languages`): 2 postings (33.3% market penetration)

</td>
</tr>
</table>
</div>

<br/>

### Role Distribution & AI Skill Penetration

<!-- ROLE_TABLE_START -->
| Role | Postings | Share | AI Skill Penetration | Median Salary | Top Required Skills |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Backend** | 2 | 33.3% | `0.0%` | $166,250 | Docker, Python, AWS |
| **AI/ML Engineer** | 1 | 16.7% | `100.0%` | N/A | Python, PyTorch, AWS |
| **Data Engineer** | 1 | 16.7% | `0.0%` | N/A | Python, CI/CD, Kafka |
| **Fullstack** | 1 | 16.7% | `0.0%` | $162,500 | Next.js, React, CI/CD |
| **Frontend** | 1 | 16.7% | `0.0%` | $115,000 | Next.js, React, Vue |
<!-- ROLE_TABLE_END -->

---

## System Architecture

```text
               ┌────────────────────────────────────────────────────────┐
               │         GitHub Actions Runner (Cron Schedule)          │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                        ┌─────────────────▼─────────────────┐
                        │       Headless n8n Workflow       │
                        │  (n8n execute --file <pipeline>)  │
                        └────────┬─────────────────┬────────┘
                                 │                 │
              ┌──────────────────▼────┐     ┌──────▼──────────────────┐
              │ Parallel Ingestion    │     │ Data Normalization Node │
              │ - Arbeitnow API       │ ──► │ - HTML Stripping        │
              │ - Jobicy API          │     │ - Deduplication (SHA256)│
              │ - RemoteOK API        │     │ - Salary Parsing to USD │
              └───────────────────────┘     └──────────────┬──────────┘
                                                           │
                                                           ▼
                                            ┌─────────────────────────┐
                                            │ Bounded Regex Matcher   │
                                            │ - Languages & Frameworks│
                                            │ - AI/ML & Cloud/Infra   │
                                            │ - Primary Role Inference│
                                            └──────────────┬──────────┘
                                                           │
                                                           ▼
                                            ┌─────────────────────────┐
                                            │ Python Analytics Engine │
                                            │ - Skill Boom Index (Δ)  │
                                            │ - Salary Percentiles    │
                                            │ - Markdown & JSON Dumps │
                                            └──────────────┬──────────┘
                                                           │
               ┌───────────────────────────┬───────────────┴─────────────┐
               ▼                           ▼                             ▼
   data/trend_metrics.json       data/latest_jobs.json             README.md (Live)
```

---

## Artifacts & Deliverables

- **`data/trend_metrics.json`**: Machine-readable statistical summary of all skills, momentum deltas, role distributions, and salary quartiles.
- **`data/latest_jobs.json`**: Standardized, cleansed, and enriched remote tech job postings.
- **`reports/latest_market_report.pdf`**: Publication-ready vector PDF brief with KPI cards and charts.
- **`data/archive/`**: Historical trend snapshots enabling longitudinal velocity calculations.

---

## Local Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests
npm test

# 3. Execute NLP extraction on mock/live dataset
node -e "const { cleanAndEnrichJob, deduplicateJobs } = require('./scripts/extractor'); const fs = require('fs'); const raw = JSON.parse(fs.readFileSync('test/mock_jobs.json', 'utf8')); const enriched = deduplicateJobs(raw).map(cleanAndEnrichJob); fs.writeFileSync('data/latest_jobs.json', JSON.stringify(enriched, null, 2));"

# 4. Compute demand metrics & update README
python scripts/aggregate_metrics.py
```
