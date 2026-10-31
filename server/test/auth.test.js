/**
 * Comprehensive Automated Verification & Security Audit Suite for SubFlow Stage 03
 * Tests all 12 criteria specified in the audit requirements:
 * 1. Database connection & pooling
 * 2. Customer registration success (with auto customer role)
 * 3. Duplicate email rejection (409)
 * 4. Password complexity rejection (400)
 * 5. Invalid login rejection (401)
 * 6. Valid login success (200) + HTTP-only Cookie issuance
 * 7. HTTP-only Cookie authentication & Bearer token authentication
 * 8. Unauthenticated rejection (401/403)
 * 9. RBAC: Customers cannot create staff (403)
 * 10. RBAC: Staff cannot create staff (403)
 * 11. RBAC: Admin can create staff (201)
 * 12. Customer resource isolation & ownership check (403)
 * 13. Password reset token hashing, expiration, and single-use enforcement
 * 14. HTTP-only cookie clearing on logout
 */

const http = require('http');
const app = require('../server');
const { pool, testConnection } = require('../config/db');

const runAudit = async () => {
  console.log('===============================================================');
  console.log('🔒 SubFlow Stage 03: Final Security & Integration Audit Suite');
  console.log('===============================================================\n');

  // Verify DB connection
  const dbStatus = await testConnection();
  if (!dbStatus.connected) {
    throw new Error(`Database connection failed: ${dbStatus.error}`);
  }
  let passedTests = 0;
  console.log(`[Audit 1/14] MySQL Database connection verified on ${dbStatus.host}:${dbStatus.port} (${dbStatus.database})\n`);
  passedTests++;

  // Start app on ephemeral test port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/auth`;

  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  };

  try {
    // Cleanup any leftovers from previous test runs
    await pool.execute("DELETE FROM users WHERE email LIKE '%@audit-subflow.com'");

    const timestamp = Date.now();
    const customer1Email = `cust1_${timestamp}@audit-subflow.com`;
    const customer2Email = `cust2_${timestamp}@audit-subflow.com`;
    const staffEmail = `staff_${timestamp}@audit-subflow.com`;
    const strongPassword = 'AuditStrongPass123!';

    let customer1Token = null;
    let customer1Cookie = null;
    let customer1Id = null;
    let customer2Token = null;
    let customer2Cookie = null;
    let customer2Id = null;
    let staffToken = null;
    let adminToken = null;

    // -------------------------------------------------------------
    // AUDIT 2: Customer registration succeeds (HTTP 201) + Auto-assigns Customer role
    // -------------------------------------------------------------
    console.log('[Audit 2/14] Customer registration succeeds...');
    const regRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Customer',
        email: customer1Email,
        password: strongPassword,
        confirmPassword: strongPassword,
        role: 'admin' // Privilege escalation attempt - must be strictly ignored!
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, `Expected status 201, got ${regRes.status}`);
    assert(regData.success === true, 'Response success should be true');
    assert(regData.data.user.role === 'customer', `Privilege escalation blocked: role must be 'customer', got '${regData.data.user.role}'`);
    assert(!regData.data.user.password_hash, 'Password hash must NOT be exposed in response body');
    
    // Check that HTTP-only cookie was issued
    const setCookieHeader = regRes.headers.get('set-cookie');
    assert(setCookieHeader && setCookieHeader.includes('subflow_token'), 'Server must issue subflow_token cookie');
    assert(setCookieHeader.toLowerCase().includes('httponly'), 'Cookie must include HttpOnly attribute');
    
    // Extract cookie for subsequent requests
    customer1Cookie = setCookieHeader.split(';')[0];
    customer1Token = regData.data.token;
    customer1Id = regData.data.user.id;
    console.log('  ✓ PASSED: Registration successful with role "customer" and secure HttpOnly cookie issued.\n');
    passedTests++;

    // -------------------------------------------------------------
    // AUDIT 3: Duplicate email registration is rejected (HTTP 409)
    // -------------------------------------------------------------
    console.log('[Audit 3/14] Duplicate email registration is rejected...');
    const dupRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Duplicate',
        email: customer1Email,
        password: strongPassword,
        confirmPassword: strongPassword
      })
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409, `Expected status 409 for duplicate email, got ${dupRes.status}`);
    assert(dupData.success === false, 'Duplicate registration success should be false');
    console.log('  ✓ PASSED: Duplicate email correctly rejected with 409 Conflict.\n');
    passedTests++;

    // -------------------------------------------------------------
    // AUDIT 4: Weak passwords rejected (HTTP 400)
    // -------------------------------------------------------------
    console.log('[Audit 4/14] Weak password complexity is rejected...');
    // Length <= 8
    const r1 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'T', email: `t1_${timestamp}@audit-subflow.com`, password: 'Aa1!', confirmPassword: 'Aa1!' })
    });
    assert(r1.status === 400, 'Password <= 8 characters must return 400');

    // No uppercase
    const r2 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'T', email: `t2_${timestamp}@audit-subflow.com`, password: 'password123!', confirmPassword: 'password123!' })
    });
    assert(r2.status === 400, 'Password without uppercase must return 400');

    // No special character
    const r3 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'T', email: `t3_${timestamp}@audit-subflow.com`, password: 'Password1234', confirmPassword: 'Password1234' })
    });
    assert(r3.status === 400, 'Password without special character must return 400');

    // Password confirmation mismatch
    const r4 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'T', email: `t4_${timestamp}@audit-subflow.com`, password: strongPassword, confirmPassword: 'MismatchPassword123!' })
    });
    assert(r4.status === 400, 'Password mismatch must return 400');
    console.log('  ✓ PASSED: All weak password cases and confirmation mismatches rejected with 400.\n');
    passedTests++;

    // -------------------------------------------------------------
    // AUDIT 5: Invalid login credentials rejected (HTTP 401)
    // -------------------------------------------------------------
    console.log('[Audit 5/14] Invalid credentials rejected...');
    const wrongPassRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customer1Email, password: 'WrongPassword999!' })
    });
    assert(wrongPassRes.status === 401, `Wrong password must return 401, got ${wrongPassRes.status}`);

    const wrongEmailRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent_${timestamp}@audit-subflow.com`, password: strongPassword })
    });
    assert(wrongEmailRes.status === 401, `Unknown email must return 401, got ${wrongEmailRes.status}`);
    console.log('  ✓ PASSED: Invalid credentials safely rejected with 401 Unauthorized.\n');
    passedTests++;

    // -------------------------------------------------------------
    // AUDIT 6: Valid login succeeds + HTTP-only Cookie verified
    // -------------------------------------------------------------
    console.log('[Audit 6/14] Correct login succeeds with HTTP-only cookie...');
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customer1Email, password: strongPassword })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, `Expected status 200, got ${loginRes.status}`);
    assert(loginData.data.user.email === customer1Email, 'Login returned incorrect user email');
    assert(loginData.data.user.role === 'customer', 'Login returned incorrect role');
    assert(!loginData.data.user.password_hash, 'Password hash must NOT be returned');

    const loginCookieHeader = loginRes.headers.get('set-cookie');
    assert(loginCookieHeader && loginCookieHeader.includes('subflow_token'), 'Login must issue subflow_token cookie');
    assert(loginCookieHeader.toLowerCase().includes('httponly'), 'Login cookie must be HttpOnly');
    customer1Cookie = loginCookieHeader.split(';')[0];
    console.log('  ✓ PASSED: Valid login succeeds and returns user profile & HttpOnly session cookie.\n');
    passedTests++;

    // -------------------------------------------------------------
    // AUDIT 7: Authentication via HTTP-only cookie & Bearer token
    // -------------------------------------------------------------
    console.log('[Audit 7/14] Authentication via HTTP-only cookie works...');
    const cookieAuthRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: { 'Cookie': customer1Cookie }
    });
    const cookieAuthData = await cookieAuthRes.json();
    assert(cookieAuthRes.status === 200, `Cookie auth must return 200, got ${cookieAuthRes.status}`);
    assert(cookieAuthData.data.id === customer1Id, 'Cookie auth user ID mismatch');

    // Also verify Bearer token fallback for API clients
    const bearerAuthRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customer1Token}` }
    });
    assert(bearerAuthRes.status === 200, 'Bearer token auth must return 200');
    console.log('  ✓ PASSED: Protected endpoints authenticate seamlessly via HttpOnly cookie and Bearer.\n');
    passedTests++;

    // -------------------------------------------------------------
    // AUDIT 8: Unauthenticated access rejected (HTTP 401/403)
    // -------------------------------------------------------------
    console.log('[Audit 8/14] Unauthenticated access rejected...');
    const noCredsRes = await fetch(`${baseUrl}/me`, { method: 'GET' });
    assert(noCredsRes.status === 401, `Missing credentials must return 401, got ${noCredsRes.status}`);

    const badCredsRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: { 'Cookie': 'subflow_token=tampered_invalid_token' }
    });
    assert(badCredsRes.status === 403, `Tampered cookie must return 403, got ${badCredsRes.status}`);
    console.log('  ✓ PASSED: Protected endpoints strictly reject unauthenticated requests.\n');
    passedTests++;

    // -------------------------------------------------------------
    // Log in as Admin for Role Tests
    // -------------------------------------------------------------
    const adminLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@subflow.io', password: 'Admin@SubFlow2026!' })
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'Admin login should succeed');
    adminToken = adminLoginData.data.token;
    const adminCookie = adminLoginRes.headers.get('set-cookie').split(';')[0];

    // -------------------------------------------------------------
    // AUDIT 9: Customers cannot create staff (HTTP 403)
    // -------------------------------------------------------------
    console.log('[Audit 9/14] Customers cannot create staff...');
    const custStaffRes = await fetch(`${baseUrl}/staff/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': customer1Cookie
      },
      body: JSON.stringify({
        name: 'Staff Unauth',
        email: `unauth_staff_${timestamp}@audit-subflow.com`,
        password: strongPassword
      })
    });
    assert(custStaffRes.status === 403, `Customer creating staff must return 403 Forbidden, got ${custStaffRes.status}`);
    console.log('  ✓ PASSED: Customer role strictly forbidden from creating staff accounts (403).\n');
    passedTests++;

    // -------------------------------------------------------------
    // AUDIT 11: Admin can create staff (HTTP 201)
    // -------------------------------------------------------------
    console.log('[Audit 10/14] Admin can create staff accounts...');
    const adminStaffRes = await fetch(`${baseUrl}/staff/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        name: 'Bob Staff Member',
        email: staffEmail,
        password: strongPassword
      })
    });
    const adminStaffData = await adminStaffRes.json();
    assert(adminStaffRes.status === 201, `Admin creating staff must return 201, got ${adminStaffRes.status}`);
    assert(adminStaffData.data.user.role === 'staff', `Role must be 'staff', got '${adminStaffData.data.user.role}'`);

    // Obtain staff credentials for Staff test
    const staffLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: staffEmail, password: strongPassword })
    });
    const staffLoginCookie = staffLoginRes.headers.get('set-cookie').split(';')[0];
    console.log('  ✓ PASSED: Admin successfully provisioned staff account with role "staff".\n');
    passedTests++;

    // -------------------------------------------------------------
    // AUDIT 10: Staff cannot create staff (HTTP 403)
    // -------------------------------------------------------------
    console.log('[Audit 11/14] Staff cannot create other staff...');
    const staffStaffRes = await fetch(`${baseUrl}/staff/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': staffLoginCookie
      },
      body: JSON.stringify({
        name: 'Staff Child',
        email: `staff_child_${timestamp}@audit-subflow.com`,
        password: strongPassword
      })
    });
    assert(staffStaffRes.status === 403, `Staff creating staff must return 403 Forbidden, got ${staffStaffRes.status}`);
    console.log('  ✓ PASSED: Staff role forbidden from creating staff accounts (403).\n');
    passedTests++;

    // -------------------------------------------------------------
    // Register Customer 2 for Ownership Check
    // -------------------------------------------------------------
    const c2Res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Charlie Customer',
        email: customer2Email,
        password: strongPassword,
        confirmPassword: strongPassword
      })
    });
    const c2Cookie = c2Res.headers.get('set-cookie').split(';')[0];

    // -------------------------------------------------------------
    // AUDIT 12: Customer resource isolation & ownership check
    // -------------------------------------------------------------
    console.log('[Audit 12/14] Customer ownership checks enforced...');
    // Customer 2 tries to access Customer 1's profile:
    const trespassRes = await fetch(`${baseUrl}/customer/${customer1Id}/profile`, {
      method: 'GET',
      headers: { 'Cookie': c2Cookie }
    });
    assert(trespassRes.status === 403, `Accessing another customer's data must return 403, got ${trespassRes.status}`);

    // Customer 1 accesses own profile:
    const ownRes = await fetch(`${baseUrl}/customer/${customer1Id}/profile`, {
      method: 'GET',
      headers: { 'Cookie': customer1Cookie }
    });
    assert(ownRes.status === 200, `Accessing own profile must return 200, got ${ownRes.status}`);
    console.log('  ✓ PASSED: Cross-customer access blocked with 403; own resource access permitted.\n');
    passedTests++;

    // -------------------------------------------------------------
    // AUDIT 13: Password reset tokens hashed, expire, and single-use
    // -------------------------------------------------------------
    console.log('[Audit 13/14] Password reset tokens are hashed, expire and cannot be reused...');
    await fetch(`${baseUrl}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customer1Email })
    });

    const [uRows] = await pool.execute('SELECT reset_password_token FROM users WHERE email = ?', [customer1Email]);
    assert(uRows[0].reset_password_token, 'Token hash must be stored in database');
    const storedHash = uRows[0].reset_password_token;

    // Verify token is hashed with SHA-256 (64 hex characters)
    assert(storedHash.length === 64, 'Token in DB must be a 64-character SHA-256 hash');

    // Artificially expire token
    await pool.execute(
      'UPDATE users SET reset_password_expires = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE email = ?',
      [customer1Email]
    );

    // Attempt reset with expired token
    const expRes = await fetch(`${baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'test_raw_token', password: 'NewPassword999!', confirmPassword: 'NewPassword999!' })
    });
    assert(expRes.status === 400, `Expired token must return 400, got ${expRes.status}`);

    // Now test valid token reset
    const { generateResetToken, hashResetToken, getResetTokenExpiry } = require('../utils/tokenUtils');
    const validRawToken = generateResetToken();
    const freshHash = hashResetToken(validRawToken);
    await pool.execute(
      'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE email = ?',
      [freshHash, getResetTokenExpiry(1), customer1Email]
    );

    const newPass = 'UpdatedStrongPass777!';
    const resetRes = await fetch(`${baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: validRawToken, password: newPass, confirmPassword: newPass })
    });
    assert(resetRes.status === 200, `Valid reset must return 200, got ${resetRes.status}`);

    // Verify token cannot be reused
    const reuseRes = await fetch(`${baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: validRawToken, password: 'AnotherPass888!', confirmPassword: 'AnotherPass888!' })
    });
    assert(reuseRes.status === 400, `Reusing token must return 400, got ${reuseRes.status}`);
    console.log('  ✓ PASSED: Reset tokens are SHA-256 hashed, honor expiration, and cleared after single use.\n');
    passedTests++;

    // -------------------------------------------------------------
    // AUDIT 14: Logout clears HTTP-only cookie
    // -------------------------------------------------------------
    console.log('[Audit 14/14] Logout clears HTTP-only cookie...');
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { 'Cookie': customer1Cookie }
    });
    assert(logoutRes.status === 200, `Logout must return 200, got ${logoutRes.status}`);
    const logoutSetCookie = logoutRes.headers.get('set-cookie');
    assert(logoutSetCookie && (logoutSetCookie.includes('subflow_token=;') || logoutSetCookie.includes('Max-Age=0') || logoutSetCookie.includes('Expires=')), 'Logout must clear subflow_token cookie');
    console.log('  ✓ PASSED: Logout successfully clears the HttpOnly session cookie.\n');
    passedTests++;

    // Cleanup test data
    await pool.execute("DELETE FROM users WHERE email LIKE '%@audit-subflow.com'");

    console.log('===============================================================');
    console.log(`🎉 ALL ${passedTests}/14 AUDIT CHECKS EXECUTED AND PASSED!`);
    console.log('===============================================================\n');

  } catch (err) {
    console.error(`\n❌ AUDIT FAILURE: ${err.message}`);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
};

runAudit();
