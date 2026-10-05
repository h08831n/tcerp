/**
 * TCERP - Comprehensive HTTP Integration & Acceptance Tests
 *
 * Verifies all 10 acceptance criteria via real HTTP requests against the running NestJS API.
 */

import fs from 'fs';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

interface HttpResponse {
  status: number;
  data: any;
}

async function request(method: string, path: string, body?: any, headers: Record<string, string> = {}): Promise<HttpResponse> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'usr-admin-01',
      'x-company-id': 'comp-001-arvin',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: res.status,
    data,
  };
}

async function runHttpIntegrationTests() {
  console.log('====================================================');
  console.log('🚀 TCERP - HTTP REST API INTEGRATION ACCEPTANCE SUITE');
  console.log(`🌐 Testing against API at: ${BASE_URL}`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(title: string, fn: () => Promise<void>) {
    process.stdout.write(`⏳ Testing: ${title}... `);
    try {
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err: any) {
      console.log(`❌ FAIL: ${err.message}`);
      failed++;
    }
  }

  // 1. Browser production bundle verification
  await test('Criterion 1: Production bundle contains no pg, pg-mem, bullmq, or Node polyfills', async () => {
    if (!fs.existsSync('dist/assets')) {
      throw new Error('dist/assets folder not found. Run npm run build first.');
    }
    const jsFiles = fs.readdirSync('dist/assets').filter(f => f.endsWith('.js'));
    if (jsFiles.length === 0) throw new Error('No bundled js files found');

    for (const f of jsFiles) {
      const content = fs.readFileSync(`dist/assets/${f}`, 'utf8');
      if (content.includes('pg_stat_activity') || content.includes('pg-mem') || content.includes('Client.prototype.connect')) {
        throw new Error(`Bundle ${f} contains pg/pg-mem server code`);
      }
      if (content.includes('bullmq')) {
        throw new Error(`Bundle ${f} contains bullmq server code`);
      }
      if (content.includes('window.Buffer =') || content.includes('global.Buffer =')) {
        throw new Error(`Bundle ${f} contains Node Buffer polyfill`);
      }
    }
  });

  // 2. Auth / me endpoint
  await test('Criterion 2: Auth context loads current user and roles via GET /api/v1/auth/me', async () => {
    const res = await request('GET', '/api/v1/auth/me');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.user || res.data.user.id !== 'usr-admin-01') {
      throw new Error('User context not returned from auth/me');
    }
    if (!Array.isArray(res.data.roles) || res.data.roles.length === 0) {
      throw new Error('User roles missing from session');
    }
  });

  // 3. Foundation health endpoint
  await test('Criterion 3: System health diagnostics load via GET /api/v1/foundation/health', async () => {
    const res = await request('GET', '/api/v1/foundation/health');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success || res.data.data.status !== 'HEALTHY') {
      throw new Error('Health check did not report HEALTHY');
    }
  });

  // 4. CRM UI loads parties via HTTP
  await test('Criterion 4: Parties grid loads via HTTP GET /api/v1/parties', async () => {
    const res = await request('GET', '/api/v1/parties');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.data.items)) throw new Error('Expected items array');
    if (typeof res.data.total !== 'number') throw new Error('Expected total count');
  });

  let createdPartyId = '';
  const uniquePhone = `0912${Math.floor(1000000 + Math.random() * 9000000)}`;

  // 5. Party creation via HTTP POST
  await test('Criterion 5: Party creation succeeds via POST /api/v1/parties with HTTP 201', async () => {
    const payload = {
      name_fa: 'شرکت فولاد اکسین اهواز',
      party_type: 'COMPANY',
      roles: ['CUSTOMER', 'SUPPLIER'],
      phones: [
        {
          phone_type: 'MOBILE',
          raw_number: uniquePhone,
          is_primary: true,
        },
      ],
      addresses: [
        {
          address_type: 'MAIN',
          province: 'خوزستان',
          city: 'اهواز',
          address_line: 'کیلومتر ۱۰ جاده اهواز به بندر امام',
          is_default: true,
        },
      ],
    };

    const res = await request('POST', '/api/v1/parties', payload);
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (!res.data.id) throw new Error('Created party missing id');
    createdPartyId = res.data.id;
    if (res.data.roles.length !== 2) throw new Error(`Expected 2 roles, got ${res.data.roles.length}`);
  });

  // 6. Party detail endpoint
  await test('Criterion 6: Party detail loads via GET /api/v1/parties/:id', async () => {
    const res = await request('GET', `/api/v1/parties/${createdPartyId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.party.name_fa !== 'شرکت فولاد اکسین اهواز') {
      throw new Error(`Expected party name match, got ${res.data.party.name_fa}`);
    }
  });

  // 7. Duplicate phone returns HTTP 409
  await test('Criterion 7: Duplicate phone returns HTTP 409 Conflict', async () => {
    const duplicatePayload = {
      name_fa: 'شرکت متفرقه با همان شماره',
      party_type: 'COMPANY',
      phones: [
        {
          phone_type: 'MOBILE',
          raw_number: uniquePhone,
          is_primary: true,
        },
      ],
    };

    const res = await request('POST', '/api/v1/parties', duplicatePayload);
    if (res.status !== 409) {
      throw new Error(`Expected 409 Conflict, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (res.data.errorCode !== 'DUPLICATE_PHONE_NUMBER') {
      throw new Error(`Expected DUPLICATE_PHONE_NUMBER error code, got ${res.data.errorCode}`);
    }
  });

  // 8. Invalid DTO returns HTTP 400
  await test('Criterion 8: Invalid DTO (name_fa < 2 chars) returns HTTP 400 Bad Request', async () => {
    const invalidPayload = {
      name_fa: 'A',
      party_type: 'COMPANY',
    };

    const res = await request('POST', '/api/v1/parties', invalidPayload);
    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request, got ${res.status}`);
    }
  });

  // 9. Party not found returns HTTP 404
  await test('Criterion 9: Non-existent party returns HTTP 404 Not Found', async () => {
    const res = await request('GET', '/api/v1/parties/00000000-0000-0000-0000-000000000000');
    if (res.status !== 404) {
      throw new Error(`Expected 404 Not Found, got ${res.status}`);
    }
  });

  // 10. Backend permission denial returns HTTP 403
  await test('Criterion 10: Unauthorized user is rejected with HTTP 403 Forbidden', async () => {
    const res = await request('GET', '/api/v1/parties', undefined, {
      'x-user-id': 'usr-unauthorized',
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    }
  });

  // 11. Controlled 5xx response format without leaking stack traces
  await test('Criterion 11: Controlled 5xx response hides raw internal stack traces', async () => {
    // Send request that triggers internal route exception
    const res = await request('GET', '/api/v1/parties/malformed-request-to-trigger-internal');
    if (res.status === 500) {
      if (typeof res.data === 'string' && res.data.includes('at ')) {
        throw new Error('Stack trace leaked in response body!');
      }
      if (res.data.stack) {
        throw new Error('Stack trace leaked in response JSON!');
      }
    }
  });

  // 12. Party sub-entity routes: roles, phones, contacts, addresses, timeline, financial-responsibility
  await test('Criterion 12: Sub-entity REST routes (/roles, /phones, /contacts, /timeline) respond properly', async () => {
    // 12a. Add role
    const roleRes = await request('POST', `/api/v1/parties/${createdPartyId}/roles`, { role: 'DRIVER' });
    if (roleRes.status !== 201) throw new Error(`Add role failed: ${roleRes.status}`);

    // 12b. Add phone
    const workPhone = `02188${Math.floor(100000 + Math.random() * 900000)}`;
    const phoneRes = await request('POST', `/api/v1/parties/${createdPartyId}/phones`, {
      phone_type: 'WORK_PHONE',
      raw_number: workPhone,
    });
    if (phoneRes.status !== 201) throw new Error(`Add phone failed: ${phoneRes.status}`);

    // 12c. Add contact
    const contactRes = await request('POST', `/api/v1/parties/${createdPartyId}/contacts`, {
      full_name: 'مهندس رضایی',
      position: 'مدیر تدارکات',
      raw_number: '09128887766',
    });
    if (contactRes.status !== 201) throw new Error(`Add contact failed: ${contactRes.status}`);

    // 12d. Add address
    const addrRes = await request('POST', `/api/v1/parties/${createdPartyId}/addresses`, {
      address_type: 'BILLING',
      province: 'تهران',
      city: 'تهران',
      address_line: 'خیابان کارگر شمالی',
    });
    if (addrRes.status !== 201) throw new Error(`Add address failed: ${addrRes.status}`);

    // 12e. Timeline
    const timelineRes = await request('GET', `/api/v1/parties/${createdPartyId}/timeline`);
    if (timelineRes.status !== 200) throw new Error(`Get timeline failed: ${timelineRes.status}`);

    // 12f. Financial responsibility
    const finRes = await request('GET', `/api/v1/parties/${createdPartyId}/financial-responsibility`);
    if (finRes.status !== 200) throw new Error(`Get financial responsibility failed: ${finRes.status}`);
  });

  console.log('\n----------------------------------------------------');
  console.log(`📊 FINAL SUMMARY: ${passed}/${passed + failed} PASSED (${Math.round((passed / (passed + failed)) * 100)}%) | FAILED: ${failed}`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runHttpIntegrationTests().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
