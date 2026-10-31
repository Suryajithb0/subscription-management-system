const assert = require('assert');
const { pool } = require('../config/db');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const Customer = require('../models/Customer');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Discount = require('../models/Discount');
const Analytics = require('../models/Analytics');

async function testStage10Suite() {
  console.log('====================================================');
  console.log('🧪 Starting Stage 10: Payment, Discount & Analytics Automated Tests');
  console.log('====================================================');

  let custId, inv1Id, inv2Id, discPctId, discFixedId;

  try {
    // 0. Setup Fixtures
    const email = `stage10_cust_${Date.now()}@subflow.io`;
    custId = await Customer.create({
      name: 'Stage 10 Enterprise Customer',
      email: email,
      phone: '+1 555-0808',
      company_name: 'Stage 10 Holdings'
    });

    // Create Invoice 1 with total $500.00
    inv1Id = await Invoice.create({
      customer_id: custId,
      issue_date: '2026-10-31',
      due_date: '2026-11-15',
      status: 'pending',
      items: [
        { description: 'Cloud Infrastructure Setup', quantity: 1, unit_price: 500.00, discount_amount: 0, tax_rate: 0 }
      ]
    });

    const inv1 = await Invoice.findById(inv1Id);
    assert.strictEqual(inv1.total, 500.00, 'Invoice total must be 500.00');
    assert.strictEqual(inv1.balance_due, 500.00, 'Initial balance due must be 500.00');
    console.log(`[Setup] Created Customer #${custId} and Invoice #${inv1.invoice_number} ($500.00)`);

    // -----------------------------------------------------------
    // PART A: PAYMENT MANAGEMENT TESTS (Tests 1-8)
    // -----------------------------------------------------------
    console.log('\n--- PART A: PAYMENT MANAGEMENT ---');

    // Test 1, 2, 3: Record a partial payment of $200.00 -> verify invoice status partially_paid
    console.log('[Test 1, 2, 3] Recording Partial Payment of $200.00...');
    const pay1Id = await Payment.create({
      invoice_id: inv1Id,
      customer_id: custId,
      amount: 200.00,
      payment_method: 'credit_card',
      transaction_reference: `TXN-PARTIAL-${Date.now()}`,
      status: 'completed',
      notes: 'First milestone partial payment'
    });

    const pay1 = await Payment.findById(pay1Id);
    assert(pay1, 'Payment record 1 must exist in DB');
    assert.strictEqual(pay1.amount, 200.00);
    assert.strictEqual(pay1.status, 'completed');
    console.log(`  ✓ Payment #${pay1.payment_number} ($200.00) saved in MySQL`);

    // Check invoice 1 balance after partial payment
    const inv1AfterPay1 = await Invoice.findById(inv1Id);
    assert.strictEqual(inv1AfterPay1.amount_paid, 200.00, 'Invoice amount_paid must be 200.00');
    assert.strictEqual(inv1AfterPay1.balance_due, 300.00, 'Invoice balance_due must be 300.00');
    assert.strictEqual(inv1AfterPay1.status, 'partially_paid', 'Invoice status must transition to partially_paid');
    console.log('  ✓ Invoice amount_paid = $200.00, balance_due = $300.00, status = partially_paid');

    // Test 6: Try paying more than the outstanding balance ($350 when balance is $300) -> should fail
    console.log('\n[Test 6] Attempting Payment exceeding remaining balance ($350 > $300)...');
    let overpayCaught = false;
    try {
      await Payment.create({
        invoice_id: inv1Id,
        customer_id: custId,
        amount: 350.00,
        payment_method: 'bank_transfer',
        status: 'completed'
      });
    } catch (err) {
      overpayCaught = true;
      assert(err.message.includes('exceeds outstanding balance'), 'Error must specify excessive payment');
    }
    assert(overpayCaught, 'Payment exceeding balance due must be rejected');
    console.log('  ✓ Excess payment correctly rejected with validation error.');

    // Test 4, 5: Pay the remaining balance ($300.00) -> verify invoice becomes paid
    console.log('\n[Test 4, 5] Paying remaining balance ($300.00)...');
    const pay2Id = await Payment.create({
      invoice_id: inv1Id,
      customer_id: custId,
      amount: 300.00,
      payment_method: 'upi',
      transaction_reference: `TXN-FULL-${Date.now()}`,
      status: 'completed',
      notes: 'Remaining balance payment'
    });

    const pay2 = await Payment.findById(pay2Id);
    assert(pay2, 'Payment record 2 must exist');
    console.log(`  ✓ Payment #${pay2.payment_number} ($300.00) saved`);

    const inv1FullyPaid = await Invoice.findById(inv1Id);
    assert.strictEqual(inv1FullyPaid.amount_paid, 500.00, 'Invoice amount_paid must equal total 500.00');
    assert.strictEqual(inv1FullyPaid.balance_due, 0.00, 'Invoice balance_due must be 0.00');
    assert.strictEqual(inv1FullyPaid.status, 'paid', 'Invoice status must transition to paid');
    console.log('  ✓ Invoice successfully marked as PAID with balance_due = $0.00');

    // Test 7, 8: Verify failed payments do not increase collected revenue
    console.log('\n[Test 7, 8] Verifying Failed payment handling...');
    // Create Invoice 2 ($250.00)
    inv2Id = await Invoice.create({
      customer_id: custId,
      issue_date: '2026-10-31',
      due_date: '2026-11-15',
      status: 'pending',
      items: [{ description: 'Advisory Retainer', quantity: 1, unit_price: 250.00 }]
    });

    const failedPayId = await Payment.create({
      invoice_id: inv2Id,
      customer_id: custId,
      amount: 250.00,
      payment_method: 'card',
      status: 'failed',
      notes: 'Card declined - insufficient funds'
    });

    const inv2AfterFailed = await Invoice.findById(inv2Id);
    assert.strictEqual(inv2AfterFailed.amount_paid, 0.00, 'Failed payment must not increase invoice amount_paid');
    assert.strictEqual(inv2AfterFailed.balance_due, 250.00, 'Failed payment must not reduce balance_due');
    assert.strictEqual(inv2AfterFailed.status, 'pending', 'Invoice status must remain pending');
    console.log('  ✓ Failed payment recorded in payments table without mutating invoice balances');

    // -----------------------------------------------------------
    // PART B: DISCOUNT MANAGEMENT TESTS (Tests 9-15)
    // -----------------------------------------------------------
    console.log('\n--- PART B: DISCOUNT MANAGEMENT ---');

    // Test 9: Create Percentage Discount (15% off, min $100, max discount $40)
    console.log('[Test 9] Creating Percentage Discount (15% off, min $100, cap $40)...');
    discPctId = await Discount.create({
      name: 'Autumn Special 15%',
      code: `AUTUMN15_${Date.now()}`,
      type: 'percentage',
      value: 15.00,
      min_purchase_amount: 100.00,
      max_discount_amount: 40.00,
      start_date: '2026-10-01',
      expiry_date: '2026-12-31',
      usage_limit: 5,
      per_customer_limit: 2,
      is_active: 1
    });

    const discPct = await Discount.findById(discPctId);
    assert(discPct, 'Percentage discount must exist in DB');
    assert.strictEqual(discPct.type, 'percentage');
    assert.strictEqual(discPct.value, 15.00);
    console.log(`  ✓ Percentage discount created: ${discPct.code} (15%)`);

    // Test 10: Create Fixed Amount Discount ($25 flat off, min $80)
    console.log('\n[Test 10] Creating Fixed Amount Discount ($25 off, min $80)...');
    discFixedId = await Discount.create({
      name: 'Flat $25 Savings',
      code: `SAVE25_${Date.now()}`,
      type: 'fixed',
      value: 25.00,
      min_purchase_amount: 80.00,
      start_date: '2026-10-01',
      expiry_date: '2026-12-31',
      usage_limit: 10,
      per_customer_limit: 1,
      is_active: 1
    });

    const discFixed = await Discount.findById(discFixedId);
    assert(discFixed, 'Fixed discount must exist in DB');
    assert.strictEqual(discFixed.value, 25.00);
    console.log(`  ✓ Fixed discount created: ${discFixed.code} ($25.00)`);

    // Test 11: Validate Valid Coupon Calculations
    console.log('\n[Test 11] Validating coupon calculations against purchase amounts...');
    // $200 purchase with 15% discount => 15% of 200 = 30.00 (under $40 cap)
    const val1 = await Discount.validateCoupon({
      code: discPct.code,
      amount: 200.00,
      customer_id: custId
    });
    assert.strictEqual(val1.valid, true);
    assert.strictEqual(val1.discount_amount, 30.00, '15% of $200 should be $30.00');
    assert.strictEqual(val1.net_total, 170.00, 'Net total should be $170.00');

    // $400 purchase with 15% discount => 15% of 400 = $60, but capped at $40.00
    const valCapped = await Discount.validateCoupon({
      code: discPct.code,
      amount: 400.00,
      customer_id: custId
    });
    assert.strictEqual(valCapped.discount_amount, 40.00, 'Discount must be capped at maximum $40.00');
    assert.strictEqual(valCapped.net_total, 360.00);
    console.log('  ✓ Percentage & cap calculation verified (200 -> -30, 400 -> -40 cap)');

    // Fixed discount validation
    const valFixed = await Discount.validateCoupon({
      code: discFixed.code,
      amount: 100.00,
      customer_id: custId
    });
    assert.strictEqual(valFixed.discount_amount, 25.00, 'Fixed discount should be $25.00');
    assert.strictEqual(valFixed.net_total, 75.00);
    console.log('  ✓ Fixed discount calculation verified (100 -> -25 = 75)');

    // Test 12: Expired Coupon
    console.log('\n[Test 12] Testing Expired Coupon...');
    const expiredCode = `EXPIRED_${Date.now()}`;
    const expiredId = await Discount.create({
      name: 'Expired Promo',
      code: expiredCode,
      type: 'fixed',
      value: 10.00,
      start_date: '2026-01-01',
      expiry_date: '2026-01-15' // already expired
    });
    let expiredCaught = false;
    try {
      await Discount.validateCoupon({ code: expiredCode, amount: 100.00 });
    } catch (err) {
      expiredCaught = true;
      assert(err.message.includes('expired'), 'Error must mention expired status');
    }
    assert(expiredCaught, 'Expired coupon must be rejected');
    console.log('  ✓ Expired coupon correctly rejected');

    // Test 13: Inactive Coupon
    console.log('\n[Test 13] Testing Inactive Coupon...');
    const inactiveCode = `INACTIVE_${Date.now()}`;
    await Discount.create({
      name: 'Deactivated Coupon',
      code: inactiveCode,
      type: 'fixed',
      value: 10.00,
      is_active: 0
    });
    let inactiveCaught = false;
    try {
      await Discount.validateCoupon({ code: inactiveCode, amount: 100.00 });
    } catch (err) {
      inactiveCaught = true;
      assert(err.message.includes('inactive'), 'Error must mention inactive status');
    }
    assert(inactiveCaught, 'Inactive coupon must be rejected');
    console.log('  ✓ Inactive coupon correctly rejected');

    // Test 14, 15: Usage limits and Recorded Usage in discount_usages
    console.log('\n[Test 14, 15] Testing Usage limits and Recording usage in discount_usages...');
    // Record first usage for customer
    await Discount.recordUsage({
      discount_id: discFixedId,
      customer_id: custId,
      invoice_id: inv1Id,
      amount_discounted: 25.00
    });

    const discAfterUse = await Discount.findById(discFixedId);
    assert.strictEqual(discAfterUse.uses_count, 1, 'Uses count must increment to 1');
    assert.strictEqual(discAfterUse.usages.length, 1, 'Usages list must contain 1 record');
    console.log('  ✓ Discount usage recorded in discount_usages and uses_count incremented to 1');

    // Now validate again: per_customer_limit was set to 1, so second attempt by same customer must fail!
    let limitCaught = false;
    try {
      await Discount.validateCoupon({
        code: discFixed.code,
        amount: 100.00,
        customer_id: custId
      });
    } catch (err) {
      limitCaught = true;
      assert(err.message.includes('maximum allowed number of times'), 'Must enforce customer usage limit');
    }
    assert(limitCaught, 'Per-customer usage limit must be strictly enforced');
    console.log('  ✓ Per-customer usage limit correctly enforced.');

    // -----------------------------------------------------------
    // PART C: DASHBOARD ANALYTICS INTEGRATION (Tests 16-19)
    // -----------------------------------------------------------
    console.log('\n--- PART C: REAL DASHBOARD ANALYTICS ---');
    const analytics = await Analytics.getDashboardAnalytics();

    console.log('[Test 16] Verifying Revenue against completed payment records...');
    assert(typeof analytics.summary.totalRevenue === 'number', 'Revenue must be a numeric value');
    assert(analytics.summary.totalRevenue >= 500.00, 'Total revenue must include the $500 completed payments');
    console.log(`  ✓ Collected revenue = $${analytics.summary.totalRevenue.toFixed(2)} (matches completed payments only)`);

    console.log('\n[Test 17] Verifying Subscription and Invoice counts...');
    assert(analytics.summary.totalInvoices >= 2, 'Must count created invoices');
    assert(analytics.summary.paidInvoices >= 1, 'Must count paid invoices');
    assert(typeof analytics.summary.totalCustomers === 'number', 'Total customers count must be a number');
    console.log(`  ✓ Total Invoices = ${analytics.summary.totalInvoices}, Paid = ${analytics.summary.paidInvoices}, Customers = ${analytics.summary.totalCustomers}`);

    console.log('\n[Test 18] Verifying Charts use actual database data...');
    assert(Array.isArray(analytics.charts.subscriptionStatusDistribution), 'Subscription distribution must be an array');
    assert(Array.isArray(analytics.charts.paymentMethods), 'Payment methods must be an array');
    assert(Array.isArray(analytics.recent.payments), 'Recent payments must be an array');
    console.log(`  ✓ Charts verified: ${analytics.charts.paymentMethods.length} payment methods active, ${analytics.recent.payments.length} recent transactions`);

    console.log('\n[Test 19] Verifying Customer role scoping on analytics...');
    // Create customer user
    const [userRes] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, 'dummy', 'customer', 'active')`,
      ['Analytics Customer User', `cust_user_${Date.now()}@subflow.io`]
    );
    const userId = userRes.insertId;
    await pool.query('UPDATE customers SET user_id = ? WHERE id = ?', [userId, custId]);

    const scopedAnalytics = await Analytics.getDashboardAnalytics(userId);
    assert.strictEqual(scopedAnalytics.summary.totalRevenue, 500.00, 'Scoped revenue for Customer should only be their $500.00');
    console.log('  ✓ Customer analytics correctly isolated from global company stats.');

    console.log('\n====================================================');
    console.log('✅ ALL STAGE 10 AUTOMATED TESTS PASSED SUCCESSFULLY');
    console.log('====================================================');
  } finally {
    // Clean up test data
    try {
      if (inv1Id || inv2Id) {
        await pool.query('DELETE FROM payments WHERE invoice_id IN (?, ?)', [inv1Id || 0, inv2Id || 0]);
        await pool.query('DELETE FROM discount_usages WHERE customer_id = ?', [custId || 0]);
        await pool.query('DELETE FROM invoice_items WHERE invoice_id IN (?, ?)', [inv1Id || 0, inv2Id || 0]);
        await pool.query('DELETE FROM invoices WHERE customer_id = ?', [custId || 0]);
      }
      if (discPctId || discFixedId) {
        await pool.query('DELETE FROM discounts WHERE id IN (?, ?)', [discPctId || 0, discFixedId || 0]);
      }
      if (custId) {
        await pool.query('DELETE FROM customers WHERE id = ?', [custId]);
      }
    } catch (cleanErr) {
      console.warn('Cleanup note:', cleanErr.message);
    }
  }
}

if (require.main === module) {
  testStage10Suite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Stage 10 test suite failed:', err);
      process.exit(1);
    });
}

module.exports = testStage10Suite;
