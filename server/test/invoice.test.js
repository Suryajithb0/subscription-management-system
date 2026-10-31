const assert = require('assert');
const { pool } = require('../config/db');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const Customer = require('../models/Customer');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const bcrypt = require('bcrypt');

async function testInvoiceAndBillingSuite() {
  console.log('====================================================');
  console.log('🧪 Starting Stage 09: Invoice & Automatic Billing Automated Tests');
  console.log('====================================================');

  let prodId, planId, cust1Id, cust2Id, subActiveId, subPausedId, subCancelledId;
  let manualInvId, subInvId;

  try {
    // 0. Setup prerequisite entities
    prodId = await Product.create({
      name: 'STAGE09_TEST_SUITE_PROD',
      product_type: 'service',
      sales_price: 150.00,
      cost_price: 30.00,
      is_active: true
    });

    planId = await Plan.create({
      product_id: prodId,
      name: 'Professional Tier Monthly',
      price: 100.00,
      billing_cycle: 'Monthly',
      minimum_quantity: 1,
      allow_pause: true,
      allow_early_close: true,
      allow_renewal: true,
      is_active: true
    });

    const email1 = `inv_cust1_${Date.now()}@subflow.io`;
    cust1Id = await Customer.create({
      name: 'Alpha Customer',
      email: email1,
      phone: '+1 555-0101',
      company_name: 'Alpha Corp'
    });

    const email2 = `inv_cust2_${Date.now()}@subflow.io`;
    cust2Id = await Customer.create({
      name: 'Beta Customer',
      email: email2,
      phone: '+1 555-0202',
      company_name: 'Beta LLC'
    });

    console.log('[Setup] Created test fixtures: Products, Plans, Customers');

    // -----------------------------------------------------------
    // TEST 1 & 3 & 4 & 5 & 6: Create Manual Invoice, Items, Tax, Unique Number, Balance Due
    // -----------------------------------------------------------
    console.log('\n[Test 1/12] Creating Manual Invoice with multiple items and tax calculations...');
    manualInvId = await Invoice.create({
      customer_id: cust1Id,
      issue_date: '2026-10-31',
      due_date: '2026-11-15',
      billing_period: 'Oct 2026 Manual Project',
      notes: 'Initial consulting and migration invoice',
      status: 'draft',
      currency: 'USD',
      amount_paid: 50.00,
      items: [
        {
          description: 'Consulting Services',
          quantity: 2,
          unit_price: 150.00,
          discount_amount: 20.00, // net: 280.00
          tax_rate: 0.10 // 10% tax = 28.00 => line total = 308.00
        },
        {
          description: 'Setup Fee',
          quantity: 1,
          unit_price: 100.00,
          discount_amount: 0.00,
          tax_rate: 0.00 // 0% tax => line total = 100.00
        }
      ]
    });

    const manualInv = await Invoice.findById(manualInvId);
    assert(manualInv, 'Manual invoice should exist in DB');
    console.log(`  ✓ Manual Invoice created: ${manualInv.invoice_number}`);

    // Verify calculations
    console.log('\n[Test 3/12 & 4/12] Verifying Line Items, Subtotal, Tax and Net Totals...');
    assert.strictEqual(manualInv.subtotal, 400.00, 'Subtotal should be 2*150 + 100 = 400');
    assert.strictEqual(manualInv.discount_amount, 20.00, 'Discount total should be 20.00');
    assert.strictEqual(manualInv.tax_amount, 28.00, 'Tax amount should be 28.00 (10% of 280)');
    assert.strictEqual(manualInv.total, 408.00, 'Total should be 400 - 20 + 28 = 408.00');
    console.log('  ✓ Verified Subtotal ($400.00), Discount ($20.00), Tax ($28.00), Total ($408.00)');

    // Verify Amount Paid and Balance Due
    console.log('\n[Test 6/12] Verifying Amount Paid and Balance Due...');
    assert.strictEqual(manualInv.amount_paid, 50.00, 'Amount paid should be 50.00');
    assert.strictEqual(manualInv.balance_due, 358.00, 'Balance due should be 408 - 50 = 358.00');
    console.log('  ✓ Verified Amount Paid ($50.00) and Balance Due ($358.00)');

    // Verify Invoice Number Uniqueness
    console.log('\n[Test 5/12] Verifying Invoice Number Uniqueness...');
    const manualInv2Id = await Invoice.create({
      customer_id: cust1Id,
      issue_date: '2026-10-31',
      due_date: '2026-11-15',
      items: [{ description: 'Item 2', quantity: 1, unit_price: 50.00 }]
    });
    const manualInv2 = await Invoice.findById(manualInv2Id);
    assert.notStrictEqual(manualInv.invoice_number, manualInv2.invoice_number, 'Invoice numbers must be unique');
    console.log(`  ✓ Unique numbers confirmed: ${manualInv.invoice_number} vs ${manualInv2.invoice_number}`);

    // -----------------------------------------------------------
    // TEST 2 & 8: Generate Invoice from Subscription and Verify Date Advancement
    // -----------------------------------------------------------
    console.log('\n[Test 2/12 & 8/12] Generating Invoice from Active Subscription...');
    const initialBillingDate = '2026-10-31';
    subActiveId = await Subscription.create({
      customer_id: cust1Id,
      plan_id: planId,
      quantity: 2,
      start_date: '2026-10-01',
      next_billing_date: initialBillingDate,
      billing_cycle: 'Monthly',
      unit_price: 100.00,
      total_amount: 200.00,
      status: 'active',
      auto_renew: true
    });

    subInvId = await Invoice.createFromSubscription(subActiveId, {
      tax_rate: 0.0825, // 8.25% standard tax
      advance_billing_date: true
    });

    const subInv = await Invoice.findById(subInvId);
    assert(subInv, 'Subscription invoice should exist');
    assert.strictEqual(subInv.subscription_id, subActiveId, 'Invoice should link to subscription');
    assert.strictEqual(subInv.subtotal, 200.00, 'Subtotal should be 2 * 100 = 200.00');
    assert.strictEqual(subInv.tax_amount, 16.50, 'Tax should be 200 * 0.0825 = 16.50');
    assert.strictEqual(subInv.total, 216.50, 'Total should be 216.50');
    console.log(`  ✓ Subscription Invoice ${subInv.invoice_number} generated with Total $216.50`);

    // Verify next billing date advanced
    const updatedSub = await Subscription.findById(subActiveId);
    const expectedNextDate = Subscription.calculateNextBillingDate(initialBillingDate, 'Monthly');
    assert.strictEqual(updatedSub.next_billing_date, expectedNextDate, 'Next billing date should advance by 1 month');
    console.log(`  ✓ Subscription next_billing_date advanced from ${initialBillingDate} to ${updatedSub.next_billing_date}`);

    // -----------------------------------------------------------
    // TEST 9: Duplicate Prevention on same subscription & period
    // -----------------------------------------------------------
    console.log('\n[Test 9/12] Testing Duplicate Invoice Prevention on same subscription & billing period...');
    let duplicateCaught = false;
    try {
      await Invoice.createFromSubscription(subActiveId, {
        billing_period_start: subInv.billing_period_start,
        billing_period_end: subInv.billing_period_end
      });
    } catch (err) {
      duplicateCaught = true;
      assert(err.message.includes('already been generated'), 'Error message should indicate duplicate generation');
    }
    assert(duplicateCaught, 'Attempt to generate duplicate invoice for the same cycle must throw an error');
    console.log('  ✓ Duplicate invoice creation correctly blocked.');

    // -----------------------------------------------------------
    // TEST 10: Verify Paused & Cancelled Subscriptions are NOT billed
    // -----------------------------------------------------------
    console.log('\n[Test 10/12] Verifying Paused & Cancelled Subscriptions are NOT billed...');
    subPausedId = await Subscription.create({
      customer_id: cust2Id,
      plan_id: planId,
      quantity: 1,
      start_date: '2026-10-01',
      next_billing_date: '2026-10-31',
      billing_cycle: 'Monthly',
      unit_price: 100.00,
      total_amount: 100.00,
      status: 'paused',
      auto_renew: true
    });

    subCancelledId = await Subscription.create({
      customer_id: cust2Id,
      plan_id: planId,
      quantity: 1,
      start_date: '2026-10-01',
      next_billing_date: '2026-10-31',
      billing_cycle: 'Monthly',
      unit_price: 100.00,
      total_amount: 100.00,
      status: 'cancelled',
      auto_renew: true
    });

    let pausedBlocked = false;
    try {
      await Invoice.createFromSubscription(subPausedId);
    } catch (err) {
      pausedBlocked = true;
      assert(err.message.includes("status 'paused'"), 'Should state paused status');
    }
    assert(pausedBlocked, 'Paused subscription invoice generation must fail');

    let cancelledBlocked = false;
    try {
      await Invoice.createFromSubscription(subCancelledId);
    } catch (err) {
      cancelledBlocked = true;
      assert(err.message.includes("status 'cancelled'"), 'Should state cancelled status');
    }
    assert(cancelledBlocked, 'Cancelled subscription invoice generation must fail');
    console.log('  ✓ Paused and Cancelled subscriptions safely rejected.');

    // -----------------------------------------------------------
    // TEST 7: Trigger Recurring Billing Engine
    // -----------------------------------------------------------
    console.log('\n[Test 7/12] Testing Automated Recurring Billing Engine (processRecurringBilling)...');
    // Create an active subscription due today
    const subDueId = await Subscription.create({
      customer_id: cust2Id,
      plan_id: planId,
      quantity: 3,
      start_date: '2026-10-01',
      next_billing_date: '2026-10-31',
      billing_cycle: 'Monthly',
      unit_price: 100.00,
      total_amount: 300.00,
      status: 'active',
      auto_renew: true
    });

    const billingRun1 = await Invoice.processRecurringBilling();
    console.log(`  Recurring run processed ${billingRun1.processed} subs, generated ${billingRun1.invoicesGenerated.length} invoice(s)`);
    assert(billingRun1.invoicesGenerated.some(inv => inv.subscriptionId === subDueId), 'Should generate invoice for due subscription');

    // Run again immediately - should NOT generate duplicates
    const billingRun2 = await Invoice.processRecurringBilling();
    assert.strictEqual(billingRun2.invoicesGenerated.length, 0, 'Second run must generate 0 invoices because billing date advanced');
    console.log('  ✓ Recurring billing successfully generated invoices and advanced billing date with zero duplicates.');

    // -----------------------------------------------------------
    // TEST 11: Customer Role Scoping
    // -----------------------------------------------------------
    console.log('\n[Test 11/12] Verifying Customer Invoices Scoping...');
    // Create a user account linked to customer 1
    const testUserEmail = `cust_user_${Date.now()}@subflow.io`;
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const [userRes] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'customer', 'active')`,
      ['Customer User 1', testUserEmail, passwordHash]
    );
    const userId = userRes.insertId;
    await pool.query('UPDATE customers SET user_id = ? WHERE id = ?', [userId, cust1Id]);

    const scopedList = await Invoice.findAll({ userId });
    assert(scopedList.invoices.length > 0, 'Customer 1 should see their own invoices');
    assert(scopedList.invoices.every(i => i.customer_id === cust1Id), 'Customer 1 must not see any invoice belonging to other customers');
    console.log(`  ✓ Scoped query returned ${scopedList.invoices.length} invoices, strictly belonging to customer ID ${cust1Id}`);

    // -----------------------------------------------------------
    // TEST 12: Verify Existing Products, Plans, Customers, and Subscriptions
    // -----------------------------------------------------------
    console.log('\n[Test 12/12] Verifying existing Products, Plans, Customers, Subscriptions integrity...');
    const testProd = await Product.findById(prodId);
    assert.strictEqual(testProd.name, 'STAGE09_TEST_SUITE_PROD');

    const testPlan = await Plan.findById(planId);
    assert.strictEqual(testPlan.name, 'Professional Tier Monthly');

    const testCust = await Customer.findById(cust1Id);
    assert.strictEqual(testCust.name, 'Alpha Customer');

    const testSub = await Subscription.findById(subActiveId);
    assert.strictEqual(testSub.id, subActiveId);
    console.log('  ✓ All core modules (Products, Plans, Customers, Subscriptions) continue to operate with 100% integrity.');

    console.log('\n====================================================');
    console.log('✅ ALL 12 INVOICE & BILLING TEST SUITES PASSED SUCCESSFULLY');
    console.log('====================================================');
  } finally {
    // Cleanup test data safely
    try {
      await pool.query('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE customer_id IN (?, ?))', [cust1Id, cust2Id]);
      await pool.query('DELETE FROM invoices WHERE customer_id IN (?, ?)', [cust1Id, cust2Id]);
      await pool.query('DELETE FROM subscription_items WHERE subscription_id IN (?, ?, ?)', [subActiveId, subPausedId, subCancelledId]);
      await pool.query('DELETE FROM subscriptions WHERE customer_id IN (?, ?)', [cust1Id, cust2Id]);
      await pool.query('DELETE FROM customers WHERE id IN (?, ?)', [cust1Id, cust2Id]);
      await pool.query('DELETE FROM plans WHERE id = ?', [planId]);
      await pool.query('DELETE FROM products WHERE id = ?', [prodId]);
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
  }
}

if (require.main === module) {
  testInvoiceAndBillingSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Test suite failed:', err);
      process.exit(1);
    });
}

module.exports = testInvoiceAndBillingSuite;
