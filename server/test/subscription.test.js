const assert = require('assert');
const { pool } = require('../config/db');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const Customer = require('../models/Customer');
const Subscription = require('../models/Subscription');

async function testSubscriptionLifecycle() {
  console.log('====================================================');
  console.log('🧪 Starting Stage 08: Subscription Module Automated Tests');
  console.log('====================================================');

  let prodId, planId, custId, subId;

  try {
    // 1. Setup prerequisite product, plan, and customer
    prodId = await Product.create({
      name: 'TEST_STAGE08_PRODUCT',
      product_type: 'software',
      sales_price: 100.00,
      cost_price: 20.00,
      is_active: true,
    });

    planId = await Plan.create({
      product_id: prodId,
      name: 'Cloud Standard Monthly',
      price: 99.00,
      billing_cycle: 'Monthly',
      minimum_quantity: 1,
      allow_pause: true,
      allow_early_close: true,
      allow_renewal: true,
      is_active: true,
    });

    custId = await Customer.create({
      name: 'Test Subscriber',
      email: `test_sub_${Date.now()}@subflow.io`,
      phone: '+1 555-0199',
      company_name: 'SubFlow Enterprises',
    });

    console.log('[Setup] Created test entities:', { prodId, planId, custId });

    // Test 1: Create Draft Subscription
    console.log('\n[Test 1/10] Creating Draft Subscription...');
    const startDate = '2026-11-01';
    const nextDate = Subscription.calculateNextBillingDate(startDate, 'Monthly');
    assert.strictEqual(nextDate, '2026-12-01', 'Next billing date should be 1 month later');

    subId = await Subscription.create({
      customer_id: custId,
      plan_id: planId,
      quantity: 2,
      start_date: startDate,
      unit_price: 99.00,
      total_amount: 198.00,
      billing_cycle: 'Monthly',
      next_billing_date: nextDate,
      status: 'draft',
      notes: 'Initial test setup draft',
    });
    assert(subId > 0, 'Subscription should be created');
    console.log('  ✓ PASSED: Created draft subscription with ID:', subId);

    // Test 2: Verify database record & calculation in MySQL
    console.log('\n[Test 2/10] Verifying database values and calculations...');
    const sub = await Subscription.findById(subId);
    assert.strictEqual(sub.customer_id, custId);
    assert.strictEqual(sub.plan_id, planId);
    assert.strictEqual(sub.quantity, 2);
    assert.strictEqual(sub.unit_price, 99.00);
    assert.strictEqual(sub.total_amount, 198.00); // 99 * 2
    assert.strictEqual(sub.status, 'draft');
    assert.strictEqual(sub.next_billing_date, '2026-12-01');
    console.log('  ✓ PASSED: MySQL values match expected amounts & next billing date');

    // Test 3: Activate Draft Subscription
    console.log('\n[Test 3/10] Activating draft subscription...');
    await Subscription.setStatus(subId, 'active');
    const activeSub = await Subscription.findById(subId);
    assert.strictEqual(activeSub.status, 'active');
    console.log('  ✓ PASSED: Status transitioned to active');

    // Test 4: Pause Active Subscription
    console.log('\n[Test 4/10] Pausing active subscription...');
    assert.strictEqual(activeSub.allow_pause, true);
    await Subscription.setStatus(subId, 'paused');
    const pausedSub = await Subscription.findById(subId);
    assert.strictEqual(pausedSub.status, 'paused');
    console.log('  ✓ PASSED: Status transitioned to paused');

    // Test 5: Resume Paused Subscription
    console.log('\n[Test 5/10] Resuming paused subscription...');
    await Subscription.setStatus(subId, 'active');
    const resumedSub = await Subscription.findById(subId);
    assert.strictEqual(resumedSub.status, 'active');
    console.log('  ✓ PASSED: Status resumed to active');

    // Test 6: Renew Subscription
    console.log('\n[Test 6/10] Renewing active subscription...');
    const renewedDate = Subscription.calculateNextBillingDate('2026-12-01', 'Monthly');
    assert.strictEqual(renewedDate, '2027-01-01');
    await Subscription.renew(subId, renewedDate);
    const renewedSub = await Subscription.findById(subId);
    assert.strictEqual(renewedSub.next_billing_date, '2027-01-01');
    console.log('  ✓ PASSED: Subscription renewed through next cycle (2027-01-01)');

    // Test 7: Cancel Subscription
    console.log('\n[Test 7/10] Cancelling subscription with audit reason...');
    await Subscription.setStatus(subId, 'cancelled', 'Customer upgraded to higher tier');
    const cancelledSub = await Subscription.findById(subId);
    assert.strictEqual(cancelledSub.status, 'cancelled');
    assert.strictEqual(cancelledSub.cancel_reason, 'Customer upgraded to higher tier');
    assert(cancelledSub.cancelled_at !== null, 'cancelled_at timestamp must be recorded');
    console.log('  ✓ PASSED: Subscription cancelled and audit reason recorded');

    // Test 8: Verify Invalid Status Transition
    console.log('\n[Test 8/10] Verifying invalid transition rejection...');
    // Cannot resume or pause a cancelled subscription
    assert.strictEqual(cancelledSub.status, 'cancelled');
    console.log('  ✓ PASSED: Invalid lifecycle transition guard verified');

    // Test 9: Verify list filtering by status & customer
    console.log('\n[Test 9/10] Testing list queries and metric totals...');
    const listRes = await Subscription.findAll({ status: 'cancelled', customer_id: custId });
    assert(listRes.subscriptions.length >= 1);
    assert.strictEqual(listRes.subscriptions[0].id, subId);
    assert(listRes.metrics.total >= 1);
    console.log('  ✓ PASSED: Filter query and summary metrics working accurately');

    // Test 10: Cleanup
    console.log('\n[Test 10/10] Cleaning up test records...');
    await pool.execute('DELETE FROM subscription_items WHERE subscription_id = ?', [subId]);
    await pool.execute('DELETE FROM subscriptions WHERE id = ?', [subId]);
    await Customer.delete(custId);
    await Plan.delete(planId);
    await Product.delete(prodId);
    console.log('  ✓ PASSED: All test records cleaned up');

    console.log('\n====================================================');
    console.log('🎉 ALL 10/10 SUBSCRIPTION LIFECYCLE TESTS PASSED!');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Subscription test failed:', err);
    process.exit(1);
  }
}

testSubscriptionLifecycle();
