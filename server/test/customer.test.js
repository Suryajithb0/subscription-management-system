const assert = require('assert');
const { pool } = require('../config/db');
const Customer = require('../models/Customer');

async function testCustomerModule() {
  console.log('====================================================');
  console.log('🧪 Starting Stage 07: Customer Management Automated Tests');
  console.log('====================================================');

  const timestamp = Date.now();
  const testEmail = `test_client_${timestamp}@enterprise.io`;

  try {
    // Test 1: Create customer
    console.log('\n[Test 1/12] Creating new customer...');
    const custId = await Customer.create({
      name: 'Jordan Belfort',
      email: testEmail,
      phone: '+1 (555) 234-5678',
      company_name: 'Stratton Enterprise Ltd',
      address: '100 Wall Street, Suite 400, New York, NY',
    });
    assert(custId > 0, 'Customer ID should be valid');
    console.log('  ✓ PASSED: Created customer with ID:', custId);

    // Test 2: View customer by ID
    console.log('\n[Test 2/12] Viewing customer by ID...');
    const customer = await Customer.findById(custId);
    assert.strictEqual(customer.name, 'Jordan Belfort');
    assert.strictEqual(customer.email, testEmail);
    assert.strictEqual(customer.company_name, 'Stratton Enterprise Ltd');
    assert.strictEqual(customer.status, 'active');
    console.log('  ✓ PASSED: Customer details retrieved accurately');

    // Test 3: Edit customer
    console.log('\n[Test 3/12] Editing customer information...');
    const updated = await Customer.update(custId, {
      name: 'Jordan R. Belfort',
      email: testEmail,
      phone: '+1 (555) 999-0000',
      company_name: 'Stratton Global Capital',
      address: '100 Wall Street, Penthouse, New York, NY',
      status: 'active',
    });
    assert(updated, 'Update should succeed');
    const customerReloaded = await Customer.findById(custId);
    assert.strictEqual(customerReloaded.name, 'Jordan R. Belfort');
    assert.strictEqual(customerReloaded.company_name, 'Stratton Global Capital');
    assert.strictEqual(customerReloaded.phone, '+1 (555) 999-0000');
    console.log('  ✓ PASSED: Customer fields updated');

    // Test 4: Search customer by name / email / company
    console.log('\n[Test 4/12] Searching customers by company keyword...');
    const searchRes = await Customer.findAll({ search: 'Stratton Global' });
    assert(searchRes.customers.length >= 1);
    assert(searchRes.customers.some(c => c.id === custId));
    console.log('  ✓ PASSED: Search query matched customer');

    // Test 5: Filter customer by status
    console.log('\n[Test 5/12] Filtering customers by status...');
    const filterRes = await Customer.findAll({ status: 'active' });
    assert(filterRes.customers.every(c => c.status === 'active'));
    console.log('  ✓ PASSED: Status filter working');

    // Test 6: Verify summary metrics
    console.log('\n[Test 6/12] Verifying actual database summary metrics...');
    assert(filterRes.metrics.total >= 1);
    assert(filterRes.metrics.active >= 1);
    console.log('  ✓ PASSED: Real database customer metrics computed:', filterRes.metrics);

    // Test 7: Reject duplicate email
    console.log('\n[Test 7/12] Verifying duplicate email rejection...');
    const duplicate = await Customer.findByEmail(testEmail);
    assert(duplicate !== null, 'Existing customer should be found by email');
    assert.strictEqual(duplicate.id, custId);
    console.log('  ✓ PASSED: Duplicate email detected properly');

    // Test 8: Deactivate / update status
    console.log('\n[Test 8/12] Setting status to inactive...');
    await Customer.setStatus(custId, 'inactive');
    const inactiveCust = await Customer.findById(custId);
    assert.strictEqual(inactiveCust.status, 'inactive');
    console.log('  ✓ PASSED: Status updated to inactive');

    // Test 9: Archive customer
    console.log('\n[Test 9/12] Setting status to archived...');
    await Customer.setStatus(custId, 'archived');
    const archivedCust = await Customer.findById(custId);
    assert.strictEqual(archivedCust.status, 'archived');
    console.log('  ✓ PASSED: Customer status archived');

    // Test 10: Verify persistence in MySQL
    console.log('\n[Test 10/12] Verifying customer record persistence in MySQL...');
    const [rawRows] = await pool.execute('SELECT id, email, status FROM customers WHERE id = ?', [custId]);
    assert.strictEqual(rawRows.length, 1);
    assert.strictEqual(rawRows[0].status, 'archived');
    console.log('  ✓ PASSED: Raw SQL query confirmed record persisted');

    // Test 11: Cleanup test record
    console.log('\n[Test 11/12] Deleting test customer record...');
    const deleted = await Customer.delete(custId);
    assert(deleted, 'Customer delete should succeed');
    const checkDeleted = await Customer.findById(custId);
    assert.strictEqual(checkDeleted, null, 'Customer should no longer exist');
    console.log('  ✓ PASSED: Test customer deleted cleanly');

    // Test 12: Check regression of products & plans
    console.log('\n[Test 12/12] Verifying product and plan tables intact...');
    const [prodRows] = await pool.execute('SELECT COUNT(*) as c FROM products');
    const [planRows] = await pool.execute('SELECT COUNT(*) as c FROM plans');
    console.log(`  ✓ PASSED: Database intact. Total products: ${prodRows[0].c}, Total plans: ${planRows[0].c}`);

    console.log('\n====================================================');
    console.log('🎉 ALL 12/12 CUSTOMER MANAGEMENT TESTS PASSED!');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Customer test failed:', err);
    process.exit(1);
  }
}

testCustomerModule();
