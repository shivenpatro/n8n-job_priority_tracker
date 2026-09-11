#!/usr/bin/env python3
"""
Statistical Aggregation & Skill Velocity Engine
for Tech Job Market & Skill Arbitrage Monitor.

Calculates:
- Skill frequency and market penetration share (%)
- Boom Index (Momentum Delta: Share_current - Share_previous)
- Role distribution & cross-role AI skill penetration
- Compensation Indexing (25th, Median, 75th percentiles)
- Outputs data/trend_metrics.json, flattened data/latest_jobs.json,
  and updates root README.md live tables.
"""

import os
import sys
import json
import math
import shutil
import argparse
import datetime
import statistics
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_TAXONOMY_PATH = ROOT_DIR / "scripts" / "taxonomy.json"
DEFAULT_JOBS_PATH = ROOT_DIR / "data" / "latest_jobs.json"
DEFAULT_FALLBACK_MOCK = ROOT_DIR / "test" / "mock_jobs.json"
DEFAULT_METRICS_PATH = ROOT_DIR / "data" / "trend_metrics.json"
DEFAULT_ARCHIVE_DIR = ROOT_DIR / "data" / "archive"
DEFAULT_README_PATH = ROOT_DIR / "README.md"


def calculate_percentiles(values):
    """
    Computes 25th percentile, median, and 75th percentile.
    Gracefully handles empty lists, single values, and lists of any size.
    """
    clean = sorted(v for v in values if v is not None and isinstance(v, (int, float)) and v > 0)
    n = len(clean)
    if n == 0:
        return {"p25": None, "median": None, "p75": None, "count": 0}
    if n == 1:
        val = round(clean[0], 2)
        return {"p25": val, "median": val, "p75": val, "count": 1}

    med = round(statistics.median(clean), 2)
    q = statistics.quantiles(clean, n=4)
    return {
        "p25": round(q[0], 2),
        "median": med,
        "p75": round(q[2], 2),
        "count": n
    }


def load_taxonomy(taxonomy_path):
    """Loads the taxonomy matrix JSON."""
    with open(taxonomy_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_previous_metrics(metrics_path, archive_dir):
    """
    Loads previous metrics if available to compute momentum delta.
    Archives previous metrics to data/archive/.
    """
    prev_shares = {}
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, "r", encoding="utf-8") as f:
                prev_data = json.load(f)

            # Map skills to previous share
            for item in prev_data.get("skills_breakdown", []):
                prev_shares[item["skill"]] = item.get("share_pct", 0.0)

            # Archive the file
            os.makedirs(archive_dir, exist_ok=True)
            timestamp_str = prev_data.get("generated_at", "")
            if timestamp_str:
                clean_ts = timestamp_str.replace(":", "-").replace(".", "-")
            else:
                clean_ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")

            archive_target = archive_dir / f"trend_metrics_{clean_ts}.json"
            shutil.copy2(metrics_path, archive_target)
        except Exception as e:
            print(f"[WARN] Could not archive or parse previous metrics: {e}", file=sys.stderr)

    return prev_shares


def aggregate(jobs, taxonomy, prev_shares):
    """
    Main aggregation logic:
    - Skill penetration shares
    - Momentum / Boom Index
    - Role distribution and AI penetration
    - Compensation index per skill and role
    """
    total_jobs = len(jobs)
    if total_jobs == 0:
        return {
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "total_jobs": 0,
            "jobs_with_salary": 0,
            "top_fastest_growing": [],
            "top_in_demand": [],
            "skills_breakdown": [],
            "roles_breakdown": [],
            "compensation_by_category": {}
        }

    # Tracking containers
    skill_counts = {}
    skill_salaries = {}
    skill_categories = {}

    # Initialize all taxonomy items
    categories = ["languages", "frameworks", "ai_ml", "infra_cloud"]
    for cat in categories:
        for skill in taxonomy.get(cat, {}).keys():
            skill_counts[skill] = 0
            skill_salaries[skill] = []
            skill_categories[skill] = cat

    # Role tracking
    role_jobs = {}
    role_ai_jobs = {}
    role_salaries = {}
    role_skills = {}

    all_salaries = []

    for job in jobs:
        salary = job.get("salary_normalized_annual")
        if salary and salary > 0:
            all_salaries.append(salary)

        # Collect detected skills
        detected_skills = set()
        detected_skills.update(job.get("languages_found", []))
        detected_skills.update(job.get("frameworks_found", []))
        detected_skills.update(job.get("ai_ml_found", []))
        detected_skills.update(job.get("cloud_found", []))

        for skill in detected_skills:
            if skill not in skill_counts:
                skill_counts[skill] = 0
                skill_salaries[skill] = []
                skill_categories[skill] = "other"
            skill_counts[skill] += 1
            if salary and salary > 0:
                skill_salaries[skill].append(salary)

        # Role analysis
        role = job.get("primary_role", "Backend")
        if role not in role_jobs:
            role_jobs[role] = 0
            role_ai_jobs[role] = 0
            role_salaries[role] = []
            role_skills[role] = {}

        role_jobs[role] += 1
        if salary and salary > 0:
            role_salaries[role].append(salary)

        # Check if job requires AI skills
        has_ai = len(job.get("ai_ml_found", [])) > 0
        if has_ai:
            role_ai_jobs[role] += 1

        for skill in detected_skills:
            role_skills[role][skill] = role_skills[role].get(skill, 0) + 1

    # Compute Skill Breakdown
    skills_breakdown = []
    for skill, count in skill_counts.items():
        share = round((count / total_jobs) * 100, 2)
        prev_share = prev_shares.get(skill, 0.0)
        delta_momentum = round(share - prev_share, 2)
        salary_stats = calculate_percentiles(skill_salaries[skill])

        skills_breakdown.append({
            "skill": skill,
            "category": skill_categories.get(skill, "other"),
            "count": count,
            "share_pct": share,
            "previous_share_pct": prev_share,
            "delta_momentum": delta_momentum,
            "salary_stats": salary_stats
        })

    # Sort rankings
    # Top 5 Fastest Growing Technologies (sorted by delta_momentum desc, then count desc)
    top_fastest_growing = sorted(
        skills_breakdown,
        key=lambda x: (x["delta_momentum"], x["count"]),
        reverse=True
    )[:5]

    # Top 5 Most In-Demand Base Skills (sorted by count desc, then share desc)
    top_in_demand = sorted(
        skills_breakdown,
        key=lambda x: (x["count"], x["share_pct"]),
        reverse=True
    )[:5]

    # Roles Breakdown
    roles_breakdown = []
    for role, count in role_jobs.items():
        role_share = round((count / total_jobs) * 100, 2)
        ai_count = role_ai_jobs[role]
        ai_pen_pct = round((ai_count / count) * 100, 2) if count > 0 else 0.0
        role_salary_stats = calculate_percentiles(role_salaries[role])

        top_role_skills = sorted(
            role_skills[role].items(),
            key=lambda item: item[1],
            reverse=True
        )[:3]

        roles_breakdown.append({
            "role": role,
            "job_count": count,
            "share_pct": role_share,
            "ai_required_jobs": ai_count,
            "ai_penetration_pct": ai_pen_pct,
            "salary_stats": role_salary_stats,
            "top_skills": [s[0] for s in top_role_skills]
        })

    roles_breakdown.sort(key=lambda x: x["job_count"], reverse=True)

    # Category Compensation Breakdown
    category_salaries = {}
    for cat in categories:
        cat_sals = []
        for skill in taxonomy.get(cat, {}).keys():
            cat_sals.extend(skill_salaries.get(skill, []))
        category_salaries[cat] = calculate_percentiles(cat_sals)

    overall_salary_stats = calculate_percentiles(all_salaries)

    return {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_jobs": total_jobs,
        "jobs_with_salary": len(all_salaries),
        "overall_salary_stats": overall_salary_stats,
        "top_fastest_growing": top_fastest_growing,
        "top_in_demand": top_in_demand,
        "skills_breakdown": skills_breakdown,
        "roles_breakdown": roles_breakdown,
        "compensation_by_category": category_salaries
    }


def generate_readme_content(metrics):
    """
    Builds a professional, comprehensive README containing dynamic live tables.
    """
    total_jobs = metrics.get("total_jobs", 0)
    jobs_with_sal = metrics.get("jobs_with_salary", 0)
    overall_sal = metrics.get("overall_salary_stats", {})
    med_sal_str = f"${overall_sal['median']:,.0f}" if overall_sal.get("median") else "N/A"
    gen_time = metrics.get("generated_at", "")[:19].replace("T", " ") + " UTC"

    # Top 10 Trending Skills
    # Sort skills by count desc, then delta desc
    sorted_skills = sorted(
        metrics.get("skills_breakdown", []),
        key=lambda x: (x["count"], x["delta_momentum"]),
        reverse=True
    )[:10]

    skills_table_lines = [
        "| Rank | Skill | Category | Frequency | Market Share | Momentum (Δ) | Median Salary (USD) | Status |",
        "| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |"
    ]

    for idx, item in enumerate(sorted_skills, start=1):
        delta = item["delta_momentum"]
        delta_str = f"+{delta:.1f}%" if delta > 0 else (f"{delta:.1f}%" if delta < 0 else "0.0%")
        if delta > 1.0:
            status = "Surging"
        elif delta >= 0.0 and item["count"] >= 3:
            status = "High Demand"
        elif delta < 0:
            status = "Cooling"
        else:
            status = "Steady"

        sal_med = item["salary_stats"].get("median")
        sal_str = f"${sal_med:,.0f}" if sal_med else "N/A"

        cat_badge = f"`{item['category']}`"
        skills_table_lines.append(
            f"| {idx} | **{item['skill']}** | {cat_badge} | {item['count']} | {item['share_pct']:.1f}% | {delta_str} | {sal_str} | {status} |"
        )

    skills_table_md = "\n".join(skills_table_lines)

    # Role Distribution Table
    role_lines = [
        "| Role | Postings | Share | AI Skill Penetration | Median Salary | Top Required Skills |",
        "| :--- | :---: | :---: | :---: | :---: | :--- |"
    ]
    for role in metrics.get("roles_breakdown", []):
        sal_med = role["salary_stats"].get("median")
        sal_str = f"${sal_med:,.0f}" if sal_med else "N/A"
        top_sk = ", ".join(role["top_skills"]) if role["top_skills"] else "N/A"
        role_lines.append(
            f"| **{role['role']}** | {role['job_count']} | {role['share_pct']:.1f}% | `{role['ai_penetration_pct']:.1f}%` | {sal_str} | {top_sk} |"
        )

    role_table_md = "\n".join(role_lines)

    # Fastest Growing & Most In Demand Cards
    fastest_lines = []
    for s in metrics.get("top_fastest_growing", []):
        fastest_lines.append(f"- **{s['skill']}** (`{s['category']}`): +{s['delta_momentum']:.1f}% share ({s['count']} postings)")
    fastest_md = "\n".join(fastest_lines) if fastest_lines else "- No data available yet"

    in_demand_lines = []
    for s in metrics.get("top_in_demand", []):
        in_demand_lines.append(f"- **{s['skill']}** (`{s['category']}`): {s['count']} postings ({s['share_pct']:.1f}% market penetration)")
    in_demand_md = "\n".join(in_demand_lines) if in_demand_lines else "- No data available yet"

    # Load recent reports table from reports/reports_index.json
    reports_index_file = ROOT_DIR / "reports" / "reports_index.json"
    reports_table_lines = [
        "| Date | Executive Report | Analyzed Postings | Top In-Demand Skill | Median Salary | Direct PDF Link |",
        "| :--- | :--- | :---: | :--- | :---: | :---: |"
    ]
    if os.path.exists(reports_index_file):
        try:
            with open(reports_index_file, "r", encoding="utf-8") as f:
                r_items = json.load(f)
            for idx, r in enumerate(r_items[:10]):
                badge = " `Latest`" if idx == 0 else ""
                link = r.get("latest_link", "reports/latest_market_report.pdf") if idx == 0 else r.get("archive_path", "reports/latest_market_report.pdf")
                reports_table_lines.append(
                    f"| **{r.get('date')}** | {r.get('title')}{badge} | {r.get('total_jobs')} | `{r.get('top_skill')}` | {r.get('median_salary')} | [View / Download PDF]({link}) |"
                )
        except Exception:
            pass

    if len(reports_table_lines) == 2:
        reports_table_lines.append(
            f"| **{gen_time[:10]}** | Executive Market Brief `Latest` | {total_jobs} | Active | {med_sal_str} | [View / Download PDF](reports/latest_market_report.pdf) |"
        )
    reports_table_md = "\n".join(reports_table_lines)

    readme_content = f"""# Tech Job Market & Skill Arbitrage Monitor

> **Zero-server, autonomous analytics pipeline** powered by headless **n8n**, Node.js/Python, and GitHub Actions. Ingests remote tech postings, performs bounded regex token extraction, computes skill velocity ("Boom Index"), indexes compensation percentiles, and publishes live market artifacts directly to this repository.

[![Analytics Pipeline](https://github.com/shivenpatro/n8n-job_priority_tracker/actions/workflows/daily_analytics.yml/badge.svg)](https://github.com/shivenpatro/n8n-job_priority_tracker/actions)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Runtime](https://img.shields.io/badge/n8n-headless%20CLI-EA4B71.svg)
![Python](https://img.shields.io/badge/Python-3.11-3776AB.svg)
![Last Run](https://img.shields.io/badge/Last%20Run-{gen_time.replace(' ', '%20')}-blue)

---

## Recent Executive PDF Reports (Last 10 Days)

> [Download Latest Executive PDF Brief](reports/latest_market_report.pdf)

<!-- REPORTS_TABLE_START -->
{reports_table_md}
<!-- REPORTS_TABLE_END -->

---

## Live Market Highlights (Latest Run: `{gen_time}`)

| Total Jobs Ingested | Postings with Salary | Market Median Salary | Active Categories |
| :---: | :---: | :---: | :---: |
| **{total_jobs}** | **{jobs_with_sal}** | **{med_sal_str}** | **Languages, Frameworks, AI/ML, Cloud** |

<br/>

### Top 10 Trending Technologies

<!-- MARKET_TABLE_START -->
{skills_table_md}
<!-- MARKET_TABLE_END -->

<br/>

<div align="center">
<table>
<tr>
<td width="50%" valign="top">

### Top 5 Fastest Growing (Boom Index $\Delta$)
{fastest_md}

</td>
<td width="50%" valign="top">

### Top 5 Most In-Demand Skills
{in_demand_md}

</td>
</tr>
</table>
</div>

<br/>

### Role Distribution & AI Skill Penetration

<!-- ROLE_TABLE_START -->
{role_table_md}
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
node -e "const {{ cleanAndEnrichJob, deduplicateJobs }} = require('./scripts/extractor'); const fs = require('fs'); const raw = JSON.parse(fs.readFileSync('test/mock_jobs.json', 'utf8')); const enriched = deduplicateJobs(raw).map(cleanAndEnrichJob); fs.writeFileSync('data/latest_jobs.json', JSON.stringify(enriched, null, 2));"

# 4. Compute demand metrics & update README
python scripts/aggregate_metrics.py
```
"""
    return readme_content


def update_readme(readme_path, metrics):
    """
    Updates root README.md. If existing, updates table between markers,
    or rewrites whole file cleanly.
    """
    new_readme_text = generate_readme_content(metrics)
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(new_readme_text)
    print(f"[SUCCESS] Updated {readme_path}")


def main():
    parser = argparse.ArgumentParser(description="Skill Velocity & Demand Analytics Engine")
    parser.add_argument("--jobs", default=str(DEFAULT_JOBS_PATH), help="Input cleansed jobs JSON path")
    parser.add_argument("--taxonomy", default=str(DEFAULT_TAXONOMY_PATH), help="Taxonomy matrix JSON path")
    parser.add_argument("--metrics", default=str(DEFAULT_METRICS_PATH), help="Output trend metrics JSON path")
    parser.add_argument("--archive", default=str(DEFAULT_ARCHIVE_DIR), help="Archive directory path")
    parser.add_argument("--readme", default=str(DEFAULT_README_PATH), help="README.md path to update")
    args = parser.parse_args()

    taxonomy = load_taxonomy(args.taxonomy)

    # Load jobs
    jobs = []
    if os.path.exists(args.jobs):
        try:
            with open(args.jobs, "r", encoding="utf-8") as f:
                jobs = json.load(f)
        except Exception as e:
            print(f"[WARN] Error reading {args.jobs}: {e}", file=sys.stderr)

    # Fallback to mock dataset if input jobs empty or not found
    if not jobs:
        print(f"[INFO] Jobs file empty or not found. Loading from {DEFAULT_FALLBACK_MOCK}...")
        try:
            with open(DEFAULT_FALLBACK_MOCK, "r", encoding="utf-8") as f:
                raw_mock = json.load(f)
            # Use basic enrichment if raw
            for r in raw_mock:
                jobs.append({
                    "id": r.get("id") or r.get("slug", "job-1"),
                    "title": r.get("title") or r.get("jobTitle") or r.get("position", ""),
                    "company": r.get("company") or r.get("companyName") or r.get("company_name", ""),
                    "salary_normalized_annual": (
                        r.get("salary_min", 0) + r.get("salary_max", 0)
                    ) // 2 if (r.get("salary_min") or r.get("salary_max")) else None,
                    "languages_found": [k for k in ["Python", "TypeScript", "JavaScript", "Go", "Rust"] if k.lower() in (r.get("description", "") + r.get("jobDescription", "")).lower()],
                    "frameworks_found": [k for k in ["React", "Next.js", "Node.js", "FastAPI"] if k.lower() in (r.get("description", "") + r.get("jobDescription", "")).lower()],
                    "ai_ml_found": [k for k in ["PyTorch", "LangChain", "OpenAI", "vLLM", "Vector DBs"] if k.lower() in (r.get("description", "") + r.get("jobDescription", "")).lower()],
                    "cloud_found": [k for k in ["AWS", "Docker", "Kubernetes", "GCP", "Terraform", "Kafka", "CI/CD"] if k.lower() in (r.get("description", "") + r.get("jobDescription", "")).lower()],
                    "primary_role": "AI/ML Engineer" if "ai" in (r.get("title") or "").lower() else ("Data Engineer" if "data" in (r.get("title") or "").lower() else "Backend")
                })
        except Exception as e:
            print(f"[ERROR] Could not load fallback mock jobs: {e}", file=sys.stderr)

    print(f"[INFO] Processing {len(jobs)} jobs...")

    # Load previous snapshot & archive
    prev_shares = load_previous_metrics(Path(args.metrics), Path(args.archive))

    # Calculate metrics
    metrics = aggregate(jobs, taxonomy, prev_shares)

    # Save output trend_metrics.json
    os.makedirs(os.path.dirname(args.metrics), exist_ok=True)
    with open(args.metrics, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"[SUCCESS] Wrote metrics to {args.metrics}")

    # Ensure data/latest_jobs.json is populated
    with open(args.jobs, "w", encoding="utf-8") as f:
        json.dump(jobs, f, indent=2)
    print(f"[SUCCESS] Flattened jobs written to {args.jobs}")

    # Update root README.md
    update_readme(Path(args.readme), metrics)


if __name__ == "__main__":
    main()
