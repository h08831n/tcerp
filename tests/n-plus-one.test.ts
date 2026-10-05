/**
 * TCERP - Acceptance Test: N+1 Elimination & Query Count Benchmark
 *
 * Verifies that listing 100 parties executes a constant O(1) number of queries (<= 4 queries)
 * instead of 100+ N+1 queries.
 */

import { getDbPool, resetInProcessDb } from '../packages/database/src/postgres';
import { PostgresPartyRepository } from '../packages/database/src/party.repository';
import { PartyType } from '../packages/domain/src';

async function runNPlusOneBenchmark() {
  console.log('====================================================');
  console.log('🚀 TCERP - N+1 ELIMINATION & QUERY COUNT BENCHMARK');
  console.log('====================================================');

  resetInProcessDb();
  const repo = new PostgresPartyRepository();
  const pool = (repo as any).pool;
  const companyId = 'comp-001-arvin';

  // Seed 100 parties in database
  console.log('⏳ Seeding 100 parties into database...');
  const startSeed = performance.now();
  for (let i = 1; i <= 100; i++) {
    const padded = String(i).padStart(3, '0');
    const mobile = `0912111${padded}`;
    await repo.createPartyWithDetails({
      party: {
        company_id: companyId,
        party_type: (i % 2 === 0 ? 'COMPANY' : 'PERSON') as PartyType,
        name_fa: `شرکت آزمایشی مقیاس ${padded}`,
        customer_score_level: i > 80 ? 'VIP' : i > 50 ? 'GOLD' : 'SILVER',
        risk_flag: false,
        operational_balance: i * 1_000_000,
        status: 'ACTIVE',
      },
      roles: ['CUSTOMER', 'SUPPLIER'],
      phones: [
        {
          company_id: companyId,
          phone_type: 'MOBILE',
          raw_number: mobile,
          normalized_number: `+98912111${padded}`,
          is_primary: true,
          is_verified: true,
        },
      ],
      addresses: [
        {
          address_type: 'MAIN',
          province: 'تهران',
          city: 'تهران',
          address_line: `خیابان آزادی پلاک ${i}`,
          is_default: true,
        },
      ],
      contacts: [
        {
          contact: {
            full_name: `مسئول بازرگانی ${i}`,
            is_primary: true,
          },
          phones: [
            {
              phone_type: 'MOBILE',
              raw_number: `0935111${padded}`,
              normalized_number: `+98935111${padded}`,
              is_primary: true,
            },
          ],
        },
      ],
    });
  }
  const seedDuration = (performance.now() - startSeed).toFixed(2);
  console.log(`✅ 100 parties seeded in ${seedDuration}ms`);

  // Wrap pool.query with query interceptor counter
  let queryCount = 0;
  const recordedQueries: string[] = [];
  const originalQuery = pool.query.bind(pool);

  (pool as any).query = async function (queryTextOrConfig: any, values?: any) {
    queryCount++;
    const sql = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
    recordedQueries.push(sql.replace(/\s+/g, ' ').trim().substring(0, 80));
    return originalQuery(queryTextOrConfig, values);
  };

  // Execute listParties for 100 parties
  console.log('⏳ Executing listParties({ limit: 100 })...');
  const startQuery = performance.now();
  const res = await repo.listParties({
    companyId,
    limit: 100,
  });
  const queryDuration = (performance.now() - startQuery).toFixed(2);

  // Restore query method
  (pool as any).query = originalQuery;

  console.log('----------------------------------------------------');
  console.log(`📊 Total Parties Retrieved: ${res.parties.length} (total in DB: ${res.total})`);
  console.log(`⏱️ Query Execution Time: ${queryDuration}ms`);
  console.log(`🔢 Total Database Queries Executed: ${queryCount}`);
  console.log('📋 Recorded Queries:');
  recordedQueries.forEach((q, idx) => console.log(`   ${idx + 1}. ${q}...`));
  console.log('----------------------------------------------------');

  if (res.parties.length !== 100) {
    throw new Error(`Expected 100 parties, got ${res.parties.length}`);
  }

  // N+1 check: Must be <= 4 queries (Count, Parties, Batch Roles, Batch Phones)
  // If N+1 were present, queryCount would be > 100!
  if (queryCount > 4) {
    throw new Error(`FAIL: N+1 query problem detected! Expected <= 4 queries, executed ${queryCount} queries.`);
  }

  // Verify that each party has primary phone and roles populated
  for (const p of res.parties) {
    if (!p.name_fa && !p.party?.name_fa) throw new Error('Party basic fields missing');
    if (p.roles.length === 0) throw new Error('Party roles missing from batch query');
    if (p.phones.length === 0) throw new Error('Party phones missing from batch query');
    // Heavy sub-entities (contacts, addresses, timeline) are excluded from lightweight list projection
    if (p.contacts.length > 0 || p.addresses.length > 0) {
      throw new Error('Heavy sub-entities (contacts/addresses) must not be loaded in list projection');
    }
  }

  console.log('✅ PASS: N+1 completely eliminated! 100 parties retrieved in exactly ' + queryCount + ' batch queries.');
  console.log('====================================================\n');
}

runNPlusOneBenchmark().catch((err) => {
  console.error('Benchmark Error:', err);
  process.exit(1);
});
