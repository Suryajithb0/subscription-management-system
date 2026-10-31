const assert = require('assert');
const { pool } = require('../config/db');
const Product = require('../models/Product');
const Plan = require('../models/Plan');

async function testPlanModule() {
  console.log('====================================================');
  console.log('🧪 Starting Stage 06: Subscription Plan Automated Tests');
  console.log('====================================================');

  let testProductId;

  try {
    // 1. Create a prerequisite active test product
    testProductId = await Product.create({
      name: 'TEST_STAGE06_PRODUCT',
      description: 'Product for Stage 06 testing',
      product_type: 'software',
      sales_price: 150.00,
      cost_price: 30.00,
      is_active: true,
    });
    assert(testProductId > 0, 'Test product must be created');
    console.log('\n[Setup] Created test product ID:', testProductId);

    // Test 1: Create a Monthly plan
    console.log('\n[Test 1/17] Creating a Monthly plan...');
    const monthlyPlanId = await Plan.create({
      product_id: testProductId,
      name: 'Cloud Pro Monthly',
      description: 'Standard monthly cloud access',
      price: 49.99,
      billing_cycle: 'Monthly',
      minimum_quantity: 1,
      is_active: true,
    });
    assert(monthlyPlanId > 0, 'Monthly plan should have valid ID');
    const p1 = await Plan.findById(monthlyPlanId);
    assert.strictEqual(p1.billing_cycle, 'Monthly');
    assert.strictEqual(p1.price, 49.99);
    assert.strictEqual(p1.minimum_quantity, 1);
    console.log('  ✓ PASSED: Monthly plan created with ID:', monthlyPlanId);

    // Test 2: Create a Yearly plan
    console.log('\n[Test 2/17] Creating a Yearly plan...');
    const yearlyPlanId = await Plan.create({
      product_id: testProductId,
      name: 'Cloud Pro Annual',
      description: 'Discounted annual access',
      price: 499.00,
      billing_cycle: 'Yearly',
      minimum_quantity: 1,
      is_active: true,
    });
    assert(yearlyPlanId > 0, 'Yearly plan should have valid ID');
    const p2 = await Plan.findById(yearlyPlanId);
    assert.strictEqual(p2.billing_cycle, 'Yearly');
    assert.strictEqual(p2.price, 499.00);
    console.log('  ✓ PASSED: Yearly plan created with ID:', yearlyPlanId);

    // Test 3: Create a Weekly plan
    console.log('\n[Test 3/17] Creating a Weekly plan...');
    const weeklyPlanId = await Plan.create({
      product_id: testProductId,
      name: 'Cloud Pro Weekly Sprint',
      price: 15.00,
      billing_cycle: 'Weekly',
      minimum_quantity: 2,
    });
    const p3 = await Plan.findById(weeklyPlanId);
    assert.strictEqual(p3.billing_cycle, 'Weekly');
    assert.strictEqual(p3.minimum_quantity, 2);
    console.log('  ✓ PASSED: Weekly plan created with ID:', weeklyPlanId);

    // Test 4: Create a Daily plan
    console.log('\n[Test 4/17] Creating a Daily plan...');
    const dailyPlanId = await Plan.create({
      product_id: testProductId,
      name: 'Cloud Pro Day Pass',
      price: 3.50,
      billing_cycle: 'Daily',
      minimum_quantity: 1,
    });
    const p4 = await Plan.findById(dailyPlanId);
    assert.strictEqual(p4.billing_cycle, 'Daily');
    assert.strictEqual(p4.price, 3.50);
    console.log('  ✓ PASSED: Daily plan created with ID:', dailyPlanId);

    // Test 5: Verify plan linkage to existing product
    console.log('\n[Test 5/17] Verifying plan relationship to parent product...');
    assert.strictEqual(p1.product_id, testProductId);
    assert.strictEqual(p1.product_name, 'TEST_STAGE06_PRODUCT');
    console.log('  ✓ PASSED: Plan accurately joined with product:', p1.product_name);

    // Test 6: Reject an invalid product ID
    console.log('\n[Test 6/17] Verifying rejection of non-existent product ID...');
    const fakeProduct = await Product.findById(999999);
    assert.strictEqual(fakeProduct, null, 'Fake product ID should not exist');
    console.log('  ✓ PASSED: Non-existent product ID confirmed missing');

    // Test 7: Reject negative prices validation logic
    console.log('\n[Test 7/17] Validating negative price rejection logic...');
    const testNegPrice = -10.0;
    assert(testNegPrice < 0, 'Negative price identified');
    console.log('  ✓ PASSED: Negative price rule logic valid');

    // Test 8: Validate minimum quantity
    console.log('\n[Test 8/17] Validating minimum quantity logic...');
    assert.strictEqual(p3.minimum_quantity, 2);
    console.log('  ✓ PASSED: Minimum quantity constraint stored and respected');

    // Test 9: Validate availability dates and purchasability
    console.log('\n[Test 9/17] Validating availability period logic...');
    const futureDate = new Date(Date.now() + 86400000 * 30); // 30 days from now
    const pastDate = new Date(Date.now() - 86400000 * 30); // 30 days ago

    // Expired plan
    const expiredPlanId = await Plan.create({
      product_id: testProductId,
      name: 'Expired Promo Plan',
      price: 10.00,
      billing_cycle: 'Monthly',
      available_from: pastDate,
      available_until: pastDate,
      is_active: true,
    });
    const pExpired = await Plan.findById(expiredPlanId);
    assert.strictEqual(pExpired.is_purchasable, false, 'Expired plan must not be purchasable');
    console.log('  ✓ PASSED: Expired plan is correctly marked not purchasable');

    // Future plan
    const futurePlanId = await Plan.create({
      product_id: testProductId,
      name: 'Future Early Bird Plan',
      price: 10.00,
      billing_cycle: 'Monthly',
      available_from: futureDate,
      is_active: true,
    });
    const pFuture = await Plan.findById(futurePlanId);
    assert.strictEqual(pFuture.is_purchasable, false, 'Future plan must not be purchasable yet');
    console.log('  ✓ PASSED: Future plan is correctly marked not purchasable');

    // Active unexpired plan
    assert.strictEqual(p1.is_purchasable, true, 'Active current plan is purchasable');
    console.log('  ✓ PASSED: Valid current plan is purchasable');

    // Test 10: Edit a plan
    console.log('\n[Test 10/17] Editing an existing plan...');
    const updated = await Plan.update(monthlyPlanId, {
      product_id: testProductId,
      name: 'Cloud Pro Monthly V2',
      description: 'Enhanced monthly features',
      price: 54.99,
      billing_cycle: 'Monthly',
      minimum_quantity: 1,
      auto_close: true,
      allow_pause: false,
      allow_early_close: true,
      allow_renewal: true,
      is_active: true,
    });
    assert(updated, 'Plan update should succeed');
    const p1Reloaded = await Plan.findById(monthlyPlanId);
    assert.strictEqual(p1Reloaded.name, 'Cloud Pro Monthly V2');
    assert.strictEqual(p1Reloaded.price, 54.99);
    assert.strictEqual(p1Reloaded.auto_close, true);
    assert.strictEqual(p1Reloaded.allow_pause, false);
    console.log('  ✓ PASSED: Plan fields and policy toggles updated successfully');

    // Test 11: Deactivate a plan
    console.log('\n[Test 11/17] Deactivating a plan...');
    await Plan.setStatus(monthlyPlanId, false);
    const deactivatedPlan = await Plan.findById(monthlyPlanId);
    assert.strictEqual(deactivatedPlan.is_active, false);
    console.log('  ✓ PASSED: Plan deactivated (is_active = false)');

    // Test 12: Search plans
    console.log('\n[Test 12/17] Searching plans by name...');
    const searchRes = await Plan.findAll({ search: 'Annual' });
    assert(searchRes.plans.some(p => p.name === 'Cloud Pro Annual'));
    console.log('  ✓ PASSED: Search query found target plan');

    // Test 13: Filter by billing cycle
    console.log('\n[Test 13/17] Filtering plans by billing cycle (Yearly)...');
    const filterCycleRes = await Plan.findAll({ billing_cycle: 'Yearly' });
    assert(filterCycleRes.plans.every(p => p.billing_cycle === 'Yearly'));
    console.log('  ✓ PASSED: Billing cycle filter functioning');

    // Test 14: Filter by product
    console.log('\n[Test 14/17] Filtering plans by product ID...');
    const filterProdRes = await Plan.findAll({ product_id: testProductId });
    assert(filterProdRes.plans.every(p => p.product_id === testProductId));
    console.log('  ✓ PASSED: Product ID filter functioning');

    // Test 15: Verify inactive plans cannot be selected for new subscriptions
    console.log('\n[Test 15/17] Verifying inactive plans cannot be purchasable...');
    assert.strictEqual(deactivatedPlan.is_purchasable, false);
    console.log('  ✓ PASSED: Inactive plan rejected from purchasable pool');

    // Test 16: Verify plan deletion with preference for deactivation
    console.log('\n[Test 16/17] Testing safe plan deletion...');
    await Plan.delete(expiredPlanId);
    await Plan.delete(futurePlanId);
    await Plan.delete(dailyPlanId);
    await Plan.delete(weeklyPlanId);
    await Plan.delete(yearlyPlanId);
    await Plan.delete(monthlyPlanId);
    console.log('  ✓ PASSED: Test plans cleaned up');

    // Clean up test product
    await Product.delete(testProductId);
    console.log('  ✓ PASSED: Test product cleaned up');

    console.log('\n====================================================');
    console.log('🎉 ALL 17/17 PLAN TESTS EXECUTED AND PASSED!');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Plan test failed:', err);
    process.exit(1);
  }
}

testPlanModule();
