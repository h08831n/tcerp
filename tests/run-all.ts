/**
 * TCERP - Comprehensive Test Suite Runner
 * Runs all automated test suites across Phase 1 Foundation and Phase 2 Party & CRM Core.
 */

import { runFoundationTests } from './foundation.test';
import { runCrmTests } from './crm.test';
import { runPostgresCrmTests } from './postgres-crm.test';

async function main() {
  console.log('====================================================');
  console.log('🚀 TCERP - RUNNING COMPREHENSIVE AUTOMATED TESTS');
  console.log('====================================================\n');

  const [foundationRes, crmRes, pgCrmRes] = await Promise.all([
    runFoundationTests(),
    runCrmTests(),
    runPostgresCrmTests(),
  ]);

  const allResults = [
    ...foundationRes.results,
    ...crmRes.results,
    ...pgCrmRes.results,
  ];

  const total = allResults.length;
  const passed = allResults.filter(r => r.passed).length;
  const failed = allResults.filter(r => !r.passed).length;

  console.log('\n--- 1. Phase 1 Foundation Tests ---');
  foundationRes.results.forEach(r => {
    console.log(`${r.passed ? '✅ PASS' : '❌ FAIL'} [${r.category}] ${r.title} (${r.durationMs}ms)`);
    if (r.error) console.error('   Error:', r.error);
  });

  console.log('\n--- 2. Phase 2 CRM Application Tests ---');
  crmRes.results.forEach(r => {
    console.log(`${r.passed ? '✅ PASS' : '❌ FAIL'} [${r.category}] ${r.title} (${r.durationMs}ms)`);
    if (r.error) console.error('   Error:', r.error);
  });

  console.log('\n--- 3. Phase 2 PostgreSQL CRM Integration Tests ---');
  pgCrmRes.results.forEach(r => {
    console.log(`${r.passed ? '✅ PASS' : '❌ FAIL'} [${r.category}] ${r.title} (${r.durationMs}ms)`);
    if (r.error) console.error('   Error:', r.error);
  });

  console.log('\n====================================================');
  console.log(`📊 FINAL SUMMARY: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%) | FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
