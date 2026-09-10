# 📈 Tech Job Market & Skill Arbitrage Monitor

> **Zero-server, autonomous analytics pipeline** powered by headless **n8n**, Node.js/Python, and GitHub Actions. Ingests remote tech postings, performs bounded regex token extraction, computes skill velocity ("Boom Index"), indexes compensation percentiles, and publishes live market artifacts directly to this repository.

[![Analytics Pipeline](https://github.com/shivenpatro/n8n-job_priority_tracker/actions/workflows/daily_analytics.yml/badge.svg)](https://github.com/shivenpatro/n8n-job_priority_tracker/actions)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Runtime](https://img.shields.io/badge/n8n-headless%20CLI-EA4B71.svg)
![Python](https://img.shields.io/badge/Python-3.11-3776AB.svg)
![Last Run](https://img.shields.io/badge/Last%20Run-2026-09-10%2014:56:54%20UTC-blue)

---

## ⚡ Live Market Highlights (Latest Run: `2026-09-10 14:56:54 UTC`)

| 📊 Total Jobs Ingested | 💰 Postings with Salary | 💵 Market Median Salary | 🎯 Active Categories |
| :---: | :---: | :---: | :---: |
| **8** | **3** | **$142,500** | **Languages, Frameworks, AI/ML, Cloud** |

<br/>

### 🚀 Top 10 Trending Technologies

<!-- MARKET_TABLE_START -->
| Rank | Skill | Category | Frequency | Market Share | Momentum (Δ) | Median Salary (USD) | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | **Python** | `languages` | 5 | 62.5% | 0.0% | $142,500 | 🔥 High Demand |
| 2 | **AWS** | `infra_cloud` | 4 | 50.0% | 0.0% | $142,500 | 🔥 High Demand |
| 3 | **Docker** | `infra_cloud` | 4 | 50.0% | 0.0% | $166,250 | 🔥 High Demand |
| 4 | **CI/CD** | `infra_cloud` | 3 | 37.5% | 0.0% | N/A | 🔥 High Demand |
| 5 | **TypeScript** | `languages` | 2 | 25.0% | 0.0% | $115,000 | 🟢 Steady |
| 6 | **React** | `frameworks` | 2 | 25.0% | 0.0% | $115,000 | 🟢 Steady |
| 7 | **Next.js** | `frameworks` | 2 | 25.0% | 0.0% | $115,000 | 🟢 Steady |
| 8 | **FastAPI** | `frameworks` | 2 | 25.0% | 0.0% | $142,500 | 🟢 Steady |
| 9 | **LangChain** | `ai_ml` | 2 | 25.0% | 0.0% | N/A | 🟢 Steady |
| 10 | **Kubernetes** | `infra_cloud` | 2 | 25.0% | 0.0% | $190,000 | 🟢 Steady |
<!-- MARKET_TABLE_END -->

<br/>

<div align="center">
<table>
<tr>
<td width="50%" valign="top">

### ⚡ Top 5 Fastest Growing (Boom Index $\Delta$)
- **Python** (`languages`): +0.0% share (5 postings)
- **AWS** (`infra_cloud`): +0.0% share (4 postings)
- **Docker** (`infra_cloud`): +0.0% share (4 postings)
- **CI/CD** (`infra_cloud`): +0.0% share (3 postings)
- **TypeScript** (`languages`): +0.0% share (2 postings)

</td>
<td width="50%" valign="top">

### 🏆 Top 5 Most In-Demand Skills
- **Python** (`languages`): 5 postings (62.5% market penetration)
- **AWS** (`infra_cloud`): 4 postings (50.0% market penetration)
- **Docker** (`infra_cloud`): 4 postings (50.0% market penetration)
- **CI/CD** (`infra_cloud`): 3 postings (37.5% market penetration)
- **TypeScript** (`languages`): 2 postings (25.0% market penetration)

</td>
</tr>
</table>
</div>

<br/>

### 👥 Role Distribution & AI Skill Penetration

<!-- ROLE_TABLE_START -->
| Role | Postings | Share | AI Skill Penetration | Median Salary | Top Required Skills |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Backend** | 6 | 75.0% | `16.7%` | $142,500 | Docker, AWS, Python |
| **AI/ML Engineer** | 1 | 12.5% | `100.0%` | N/A | PyTorch, Python, Docker |
| **Data Engineer** | 1 | 12.5% | `0.0%` | N/A | Terraform, Python, GCP |
<!-- ROLE_TABLE_END -->

---

## 🛠️ System Architecture

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

## 📦 Artifacts & Deliverables

- **`data/trend_metrics.json`**: Machine-readable statistical summary of all skills, momentum deltas, role distributions, and salary quartiles.
- **`data/latest_jobs.json`**: Standardized, cleansed, and enriched remote tech job postings.
- **`reports/latest_market_report.pdf`**: Publication-ready vector PDF brief with KPI cards and charts.
- **`data/archive/`**: Historical trend snapshots enabling longitudinal velocity calculations.

---

## 💻 Local Quickstart

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
