const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

test('Statistical Aggregation - Calculations & Outputs', () => {
  // 1. Run the aggregation script
  const stdout = execSync('python scripts/aggregate_metrics.py', { encoding: 'utf8' });
  assert.ok(stdout.includes('[SUCCESS] Wrote metrics'), 'Expected success output from aggregate_metrics.py');

  // 2. Verify data/trend_metrics.json exists and adheres to schema
  const metricsPath = path.resolve('data/trend_metrics.json');
  assert.ok(fs.existsSync(metricsPath), 'Expected data/trend_metrics.json to exist');

  const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
  assert.ok(metrics.total_jobs > 0, 'Total jobs should be greater than 0');
  assert.ok(Array.isArray(metrics.top_fastest_growing), 'top_fastest_growing should be an array');
  assert.ok(Array.isArray(metrics.top_in_demand), 'top_in_demand should be an array');
  assert.ok(metrics.top_fastest_growing.length <= 5, 'Top fastest growing capped at 5');
  assert.ok(metrics.top_in_demand.length <= 5, 'Top in demand capped at 5');

  // 3. Verify math formulas
  for (const skill of metrics.skills_breakdown) {
    // Share = (N_skill / N_total_jobs) * 100
    const expectedShare = Math.round((skill.count / metrics.total_jobs) * 10000) / 100;
    assert.equal(
      skill.share_pct,
      expectedShare,
      `Share percentage mismatch for skill ${skill.skill}`
    );

    // Delta momentum = Share_current - Share_previous
    const expectedDelta = Math.round((skill.share_pct - skill.previous_share_pct) * 100) / 100;
    assert.equal(
      skill.delta_momentum,
      expectedDelta,
      `Delta momentum mismatch for skill ${skill.skill}`
    );

    // Percentiles check
    const p = skill.salary_stats;
    if (p.count >= 2) {
      assert.ok(p.p25 <= p.median, `p25 (${p.p25}) should be <= median (${p.median})`);
      assert.ok(p.median <= p.p75, `median (${p.median}) should be <= p75 (${p.p75})`);
    }
  }

  // 4. Verify Role Distribution and AI Penetration
  assert.ok(metrics.roles_breakdown.length > 0, 'Expected at least one role breakdown entry');
  for (const role of metrics.roles_breakdown) {
    assert.ok(role.role, 'Role name must exist');
    assert.ok(typeof role.ai_penetration_pct === 'number', 'AI penetration percentage must be a number');
    assert.ok(role.ai_penetration_pct >= 0 && role.ai_penetration_pct <= 100, 'AI penetration must be between 0 and 100');
  }

  // 5. Verify data/latest_jobs.json exists
  const jobsPath = path.resolve('data/latest_jobs.json');
  assert.ok(fs.existsSync(jobsPath), 'Expected data/latest_jobs.json to exist');
  const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
  assert.equal(jobs.length, metrics.total_jobs, 'Flattened jobs count should equal total_jobs in metrics');

  // 6. Verify README.md table exists
  const readmePath = path.resolve('README.md');
  assert.ok(fs.existsSync(readmePath), 'Expected README.md to exist');
  const readme = fs.readFileSync(readmePath, 'utf8');
  assert.ok(readme.includes('<!-- MARKET_TABLE_START -->'), 'Expected MARKET_TABLE_START in README');
  assert.ok(readme.includes('<!-- MARKET_TABLE_END -->'), 'Expected MARKET_TABLE_END in README');
  assert.ok(readme.includes('| Rank | Skill | Category |'), 'Expected table header in README');
});
