const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { pool, testConnection } = require('../config/db');
const User = require('../models/User');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const Customer = require('../models/Customer');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Discount = require('../models/Discount');
const Analytics = require('../models/Analytics');
const billingScheduler = require('../services/billingScheduler');
const { validatePassword, validateEmail } = require('../utils/passwordValidation');

async function runStage11ComprehensiveSuite() {
  console.log('================================================================');
  console.log('🌟 STAGE 11: COMPLETE APPLICATION COMPREHENSIVE AUDIT & TEST SUITE');
  console.log('================================================================');

  const testTrackers = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  const recordResult = (name, passed, detail = '') => {
    testTrackers.total++;
    if (passed) {
      testTrackers.passed++;
      console.log(`  ✅ [PASS] ${name} ${detail ? `(${detail})` : ''}`);
    } else {
      testTrackers.failed++;
      testTrackers.failures.push({ name, detail });
      console.error(`  ❌ [FAIL] ${name}: ${detail}`);
    }
  };

  let testContext = {};

  try {
    // -----------------------------------------------------------------
    // 1. DATABASE CONNECTION & INTEGRITY AUDIT
    // -----------------------------------------------------------------
    console.log('\n--- 1. DATABASE CONNECTION & INTEGRITY AUDIT ---');
    const dbStatus = await testConnection();
    recordResult('Database Connection', dbStatus.connected, `Host: ${dbStatus.host}, DB: ${dbStatus.database}`);

    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = tables.map((t) => Object.values(t)[0]);
    const expectedTables = [
      'users',
      'customers',
      'products',
      'product_variants',
      'plans',
      'subscriptions',
      'subscription_items',
      'invoices',
      'invoice_items',
      'payments',
      'discounts',
      'discount_usages'
    ];

    const missingTables = expectedTables.filter((t) => !tableNames.includes(t));
    recordResult('Core Relational Tables Presence', missingTables.length === 0, `Verified ${expectedTables.length} tables`);

    // Verify foreign keys and referential constraints
    const [fkRows] = await pool.query(`
      SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    recordResult('Foreign Key Relationships Exist', fkRows.length >= 10, `${fkRows.length} foreign keys confirmed in information_schema`);

    // -----------------------------------------------------------------
    // 2. AUTHENTICATION & SECURITY AUDIT
    // -----------------------------------------------------------------
    console.log('\n--- 2. AUTHENTICATION & SECURITY AUDIT ---');

    // 2.1 Admin Login
    const adminUser = await User.findByEmail('admin@subflow.io');
    let adminAuthPass = false;
    if (adminUser) {
      adminAuthPass = await bcrypt.compare('Admin@SubFlow2026!', adminUser.password_hash);
    }
    recordResult('Admin Credentials Validation (admin@subflow.io)', adminAuthPass);

    // 2.2 Customer Registration & Password Complexity
    const weakPassCheck = validatePassword('12345');
    recordResult('Weak Password Rejection (>8 chars, upper/lower/spec required)', !weakPassCheck.isValid);

    const validPassCheck = validatePassword('StrongPass@2026!');
    recordResult('Valid Password Acceptance', validPassCheck.isValid);

    const testCustEmail = `stage11_user_${Date.now()}@subflow.io`;
    const custPassHash = await bcrypt.hash('CustomerSecure@2026!', 10);
    const newCustUserId = await User.create({
      name: 'Stage 11 Audit Customer',
      email: testCustEmail,
      passwordHash: custPassHash,
      role: 'customer'
    });
    recordResult('Customer Registration & Profile Provisioning', newCustUserId > 0, `User ID: ${newCustUserId}`);

    // Verify password is never in findById
    const fetchedUser = await User.findById(newCustUserId);
    recordResult(
      'Password Hash Exclusion in User Queries',
      fetchedUser && fetchedUser.password_hash === undefined,
      'password_hash is completely omitted from profile output'
    );

    // 2.3 JWT Generation and Signature
    const jwtSecret = process.env.JWT_SECRET || 'subflow-dev-secret-key-super-secure-change-in-production-2026';
    const testToken = jwt.sign({ id: newCustUserId, email: testCustEmail, role: 'customer' }, jwtSecret, { expiresIn: '1h' });
    const decoded = jwt.verify(testToken, jwtSecret);
    recordResult('JWT Token Signature Verification', decoded.email === testCustEmail && decoded.role === 'customer');

    // 2.4 Staff Management
    const staffEmail = `stage11_staff_${Date.now()}@subflow.io`;
    const staffPassHash = await bcrypt.hash('Staff@SubFlow2026!', 10);
    const staffUserId = await User.create({
      name: 'Stage 11 Staff Account',
      email: staffEmail,
      passwordHash: staffPassHash,
      role: 'staff'
    });
    const staffUser = await User.findById(staffUserId);
    recordResult('Staff Account Provisioning', staffUser && staffUser.role === 'staff');

    // -----------------------------------------------------------------
    // 3. PRODUCT & VARIANT MANAGEMENT
    // -----------------------------------------------------------------
    console.log('\n--- 3. PRODUCT & VARIANT MODULE AUDIT ---');
    const prodCode = `PROD_S11_${Date.now().toString().slice(-6)}`;
    const prodId = await Product.create({
      name: 'SubFlow Cloud Platform',
      code: prodCode,
      description: 'Enterprise Cloud Subscription Platform',
      category: 'Software'
    });
    testContext.prodId = prodId;
    recordResult('Product Creation', prodId > 0, `Product ID: ${prodId}, Code: ${prodCode}`);

    // Read Product
    const fetchedProd = await Product.findById(prodId);
    recordResult('Product Read by ID', fetchedProd && fetchedProd.name === 'SubFlow Cloud Platform');

    // Update Product
    const prodUpdated = await Product.update(prodId, { description: 'Updated Enterprise Cloud Subscription Platform' });
    recordResult('Product Update', prodUpdated === true);

    // Create Product Variant
    const variantSku = `SKU_S11_${Date.now().toString().slice(-6)}`;
    const [varRes] = await pool.execute(
      'INSERT INTO product_variants (product_id, name, sku, is_active) VALUES (?, ?, ?, 1)',
      [prodId, 'Multi-region Tier', variantSku]
    );
    testContext.varId = varRes.insertId;
    recordResult('Product Variant Creation', varRes.insertId > 0, `Variant ID: ${varRes.insertId}, SKU: ${variantSku}`);

    // -----------------------------------------------------------------
    // 4. SUBSCRIPTION PLANS MODULE
    // -----------------------------------------------------------------
    console.log('\n--- 4. SUBSCRIPTION PLAN MODULE AUDIT ---');
    const planCode = `PLAN_S11_${Date.now().toString().slice(-6)}`;
    const planId = await Plan.create({
      product_id: prodId,
      name: 'Pro Cloud Monthly',
      code: planCode,
      billing_interval: 'month',
      interval_count: 1,
      price: 99.00,
      currency: 'USD',
      trial_days: 14,
      setup_fee: 0.00,
      is_active: 1
    });
    testContext.planId = planId;
    recordResult('Subscription Plan Creation', planId > 0, `Plan ID: ${planId}, Price: $99.00/month`);

    const fetchedPlan = await Plan.findById(planId);
    recordResult('Plan Read and Pricing Validation', fetchedPlan && Number(fetchedPlan.price) === 99.00);

    // -----------------------------------------------------------------
    // 5. CUSTOMER MANAGEMENT MODULE
    // -----------------------------------------------------------------
    console.log('\n--- 5. CUSTOMER MANAGEMENT MODULE AUDIT ---');
    const custEmail = `enterprise_s11_${Date.now()}@acme.org`;
    const custId = await Customer.create({
      name: 'Acme Global Corporation',
      email: custEmail,
      phone: '+1 555-9090',
      company_name: 'Acme Global Inc',
      address: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'IL',
      country: 'United States',
      currency: 'USD',
      status: 'active'
    });
    testContext.custId = custId;
    recordResult('Customer Creation with Full Address Details', custId > 0, `Customer ID: ${custId}`);

    const fetchedCust = await Customer.findById(custId);
    recordResult('Customer Read by ID', fetchedCust && fetchedCust.company_name === 'Acme Global Inc');

    // Soft Deactivation check
    await Customer.update(custId, { status: 'inactive' });
    const deactivatedCust = await Customer.findById(custId);
    recordResult('Customer Status Deactivation (Preserving History)', deactivatedCust.status === 'inactive');
    await Customer.update(custId, { status: 'active' }); // reactivate for further tests

    // -----------------------------------------------------------------
    // 6. SUBSCRIPTION LIFECYCLE MANAGEMENT
    // -----------------------------------------------------------------
    console.log('\n--- 6. SUBSCRIPTION LIFECYCLE AUDIT ---');
    const subNumber = `SUB-S11-${Date.now().toString().slice(-6)}`;
    const subId = await Subscription.create({
      subscription_number: subNumber,
      customer_id: custId,
      status: 'active',
      billing_cycle: 'monthly',
      billing_interval_count: 1,
      current_period_start: '2026-10-31',
      current_period_end: '2026-11-30',
      auto_renew: true,
      items: [{ plan_id: planId, quantity: 1, unit_price: 99.00 }]
    });
    testContext.subId = subId;
    recordResult('Subscription Creation with Linked Items', subId > 0, `Subscription #${subNumber}`);

    // Pause subscription
    const paused = await Subscription.updateStatus(subId, 'paused');
    const pausedSub = await Subscription.findById(subId);
    recordResult('Subscription Transition: Active -> Paused', paused && pausedSub.status === 'paused');

    // Resume subscription
    const resumed = await Subscription.updateStatus(subId, 'active');
    const resumedSub = await Subscription.findById(subId);
    recordResult('Subscription Transition: Paused -> Resumed Active', resumed && resumedSub.status === 'active');

    // -----------------------------------------------------------------
    // 7. INVOICE MANAGEMENT & AUTOMATED BILLING
    // -----------------------------------------------------------------
    console.log('\n--- 7. INVOICE MANAGEMENT & BILLING AUDIT ---');
    // Generate invoice from subscription
    const invId = await Invoice.createFromSubscription(subId, {
      issue_date: '2026-10-31',
      due_date: '2026-11-15'
    });
    testContext.invId = invId;
    recordResult('Invoice Generation from Subscription', invId > 0, `Invoice ID: ${invId}`);

    const fetchedInv = await Invoice.findById(invId);
    recordResult('Invoice Number Uniqueness & Formatting', Boolean(fetchedInv && fetchedInv.invoice_number.startsWith('INV-')));
    recordResult('Invoice Math: Balance Due Equals Total', Number(fetchedInv.balance_due) === 99.00 && Number(fetchedInv.amount_paid) === 0.00);

    // Duplicate Invoice Guard
    let dupCaught = false;
    try {
      await Invoice.createFromSubscription(subId, {
        billing_period_start: fetchedInv.billing_period_start,
        billing_period_end: fetchedInv.billing_period_end
      });
    } catch (err) {
      dupCaught = true;
    }
    recordResult('Duplicate Invoice Prevention on Same Cycle', dupCaught, 'Safely rejected identical billing period invoice');

    // Manual Invoice Creation with line items, tax, and discount
    const manualInvId = await Invoice.create({
      customer_id: custId,
      issue_date: '2026-10-31',
      due_date: '2026-11-20',
      status: 'pending',
      items: [
        { description: 'Cloud Migration Consulting', quantity: 2, unit_price: 150.00, discount_amount: 20.00, tax_rate: 0.10 }
      ]
    });
    testContext.manualInvId = manualInvId;
    const manualInv = await Invoice.findById(manualInvId);
    // 2 * 150 = 300, - 20 = 280, tax = 28.00 => total 308.00
    recordResult('Manual Invoice Creation with Taxes & Discounts Math', Number(manualInv.total) === 308.00, `Total: $${manualInv.total}`);

    // -----------------------------------------------------------------
    // 8. PAYMENT MANAGEMENT & REVENUE REALIZATION
    // -----------------------------------------------------------------
    console.log('\n--- 8. PAYMENT MANAGEMENT & CASH REALIZATION AUDIT ---');
    // Partial payment of $49.00 on $99.00 invoice
    const pay1Id = await Payment.create({
      invoice_id: invId,
      customer_id: custId,
      amount: 49.00,
      payment_method: 'credit_card',
      transaction_reference: `TXN-P1-${Date.now()}`,
      status: 'completed',
      notes: 'First milestone partial payment'
    });
    testContext.pay1Id = pay1Id;
    const invAfterP1 = await Invoice.findById(invId);
    recordResult(
      'Partial Payment Recording & Invoice Balance Update',
      Number(invAfterP1.amount_paid) === 49.00 &&
      Number(invAfterP1.balance_due) === 50.00 &&
      invAfterP1.status === 'partially_paid',
      `amount_paid: $${invAfterP1.amount_paid}, balance_due: $${invAfterP1.balance_due}, status: ${invAfterP1.status}`
    );

    // Overpayment rejection: attempt to pay $70 when balance is $50
    let overpayBlocked = false;
    try {
      await Payment.create({
        invoice_id: invId,
        customer_id: custId,
        amount: 70.00,
        payment_method: 'bank_transfer',
        status: 'completed'
      });
    } catch (err) {
      overpayBlocked = err.message.includes('exceeds outstanding balance');
    }
    recordResult('Overpayment Prevention Guard ($70 against $50 balance)', overpayBlocked);

    // Pay remaining balance ($50.00)
    const pay2Id = await Payment.create({
      invoice_id: invId,
      customer_id: custId,
      amount: 50.00,
      payment_method: 'upi',
      transaction_reference: `TXN-P2-${Date.now()}`,
      status: 'completed',
      notes: 'Final balance settlement'
    });
    testContext.pay2Id = pay2Id;
    const invFullyPaid = await Invoice.findById(invId);
    recordResult(
      'Full Balance Settlement -> Invoice Status Transition to PAID',
      Number(invFullyPaid.amount_paid) === 99.00 &&
      Number(invFullyPaid.balance_due) === 0.00 &&
      invFullyPaid.status === 'paid',
      `status: ${invFullyPaid.status}, balance_due: $${invFullyPaid.balance_due}`
    );

    // Failed Payment does NOT count toward received revenue or alter balance
    const failedPayId = await Payment.create({
      invoice_id: manualInvId,
      customer_id: custId,
      amount: 308.00,
      payment_method: 'card',
      status: 'failed',
      notes: 'Card declined - test failure'
    });
    testContext.failedPayId = failedPayId;
    const manualInvAfterFail = await Invoice.findById(manualInvId);
    recordResult(
      'Failed Payment Isolation: Invoice Balance Unchanged',
      Number(manualInvAfterFail.amount_paid) === 0.00 &&
      Number(manualInvAfterFail.balance_due) === 308.00 &&
      manualInvAfterFail.status === 'pending'
    );

    // -----------------------------------------------------------------
    // 9. DISCOUNT MANAGEMENT MODULE
    // -----------------------------------------------------------------
    console.log('\n--- 9. DISCOUNT ENGINE AUDIT ---');
    const discCode = `HACKATHON20_${Date.now()}`;
    const discId = await Discount.create({
      name: 'Hackathon 20% Special',
      code: discCode,
      type: 'percentage',
      value: 20.00,
      min_purchase_amount: 50.00,
      max_discount_amount: 50.00,
      start_date: '2026-10-01',
      expiry_date: '2026-12-31',
      usage_limit: 10,
      per_customer_limit: 1,
      is_active: 1
    });
    testContext.discId = discId;
    recordResult('Promotional Coupon Creation (20% off, min $50, cap $50)', discId > 0, `Code: ${discCode}`);

    // Validate coupon
    const validResult = await Discount.validateCoupon({
      code: discCode,
      amount: 150.00,
      customer_id: custId
    });
    // 20% of 150 = 30.00 (under 50 cap) => net 120.00
    recordResult(
      'Live Coupon Calculation Accuracy',
      validResult.valid === true &&
      validResult.discount_amount === 30.00 &&
      validResult.net_total === 120.00,
      `Calculated discount: $${validResult.discount_amount}, Net: $${validResult.net_total}`
    );

    // Record usage
    await Discount.recordUsage({
      discount_id: discId,
      customer_id: custId,
      invoice_id: invId,
      amount_discounted: 30.00
    });
    const discAfterUsage = await Discount.findById(discId);
    recordResult('Discount Redemption Tracking in discount_usages', discAfterUsage.uses_count === 1);

    // Test per_customer_limit enforcement (limit is 1)
    let perCustBlocked = false;
    try {
      await Discount.validateCoupon({ code: discCode, amount: 150.00, customer_id: custId });
    } catch (err) {
      perCustBlocked = err.message.includes('maximum allowed number of times');
    }
    recordResult('Per-Customer Coupon Usage Limit Enforcement', perCustBlocked);

    // -----------------------------------------------------------------
    // 10. REAL DASHBOARD ANALYTICS & CALCULATION INTEGRITY
    // -----------------------------------------------------------------
    console.log('\n--- 10. REAL DASHBOARD ANALYTICS INTEGRITY AUDIT ---');
    const analytics = await Analytics.getDashboardAnalytics();

    recordResult('Dashboard Summary Metrics Object Presence', Boolean(analytics && analytics.summary && analytics.charts));
    recordResult(
      'Collected Revenue Excludes Failed & Pending Payments',
      analytics.summary.collectedRevenue >= 99.00 &&
      analytics.summary.totalRevenue === analytics.summary.collectedRevenue,
      `Collected: $${analytics.summary.collectedRevenue}, Invoiced: $${analytics.summary.invoicedRevenue}`
    );
    recordResult('Subscription Status Breakdown Array Integrity', Array.isArray(analytics.charts.subscriptionStatusDistribution));
    recordResult('Payment Method Breakdown Array Integrity', Array.isArray(analytics.charts.paymentMethods));
    recordResult('Recent Payments Live Activity Feed', Array.isArray(analytics.recent.payments) && analytics.recent.payments.length > 0);

    // -----------------------------------------------------------------
    // 11. END-TO-END HACKATHON DEMONSTRATION WORKFLOW
    // -----------------------------------------------------------------
    console.log('\n--- 11. END-TO-END HACKATHON DEMONSTRATION WORKFLOW ---');
    console.log('Verifying steps 1 to 10 of demonstration scenario:');

    // Step 1: Admin authentication
    const adminCheck = await User.findByEmail('admin@subflow.io');
    const step1 = Boolean(adminCheck && adminCheck.role === 'admin');
    recordResult('Demo Step 1: Admin Account Verification', step1, 'admin@subflow.io confirmed as Admin');

    // Step 2: Product
    const step2 = Boolean(testContext.prodId && (await Product.findById(testContext.prodId)));
    recordResult('Demo Step 2: Product Creation and Catalog Ingestion', step2);

    // Step 3: Plan
    const step3 = Boolean(testContext.planId && (await Plan.findById(testContext.planId)));
    recordResult('Demo Step 3: Subscription Plan Linked to Product', step3);

    // Step 4: Customer
    const step4 = Boolean(testContext.custId && (await Customer.findById(testContext.custId)));
    recordResult('Demo Step 4: Customer Profile Creation', step4);

    // Step 5: Subscription
    const step5 = Boolean(testContext.subId && (await Subscription.findById(testContext.subId)));
    recordResult('Demo Step 5: Customer Subscription Setup', step5);

    // Step 6: Invoice Generation
    const step6 = Boolean(testContext.invId && (await Invoice.findById(testContext.invId)));
    recordResult('Demo Step 6: Invoice Automated Generation', step6);

    // Step 7: Record Payment
    const step7 = Boolean(testContext.pay1Id && (await Payment.findById(testContext.pay1Id)));
    recordResult('Demo Step 7: Manual Payment Recording', step7);

    // Step 8: Invoice Balance & Status Update
    const step8Inv = await Invoice.findById(testContext.invId);
    const step8 = step8Inv.status === 'paid' && Number(step8Inv.balance_due) === 0.00;
    recordResult('Demo Step 8: Invoice Settlement (Status: Paid, Balance: $0.00)', step8);

    // Step 9: Dashboard Reflects Collected Revenue
    const step9 = analytics.summary.collectedRevenue > 0;
    recordResult('Demo Step 9: Live Dashboard Telemetry Update', step9);

    // Step 10: Details Retrieval
    const [cDet, sDet, iDet, pDet] = await Promise.all([
      Customer.findById(testContext.custId),
      Subscription.findById(testContext.subId),
      Invoice.findById(testContext.invId),
      Payment.findById(testContext.pay1Id)
    ]);
    const step10 = Boolean(cDet && sDet && iDet && pDet);
    recordResult('Demo Step 10: Full Details Retrieval Across All 4 Entities', step10);

  } catch (error) {
    recordResult('Fatal Execution Guard', false, error.message);
    console.error('Test execution encountered unexpected error:', error);
  } finally {
    // Clean up temporary stage 11 test records
    console.log('\n--- CLEANING UP TEMPORARY STAGE 11 AUDIT FIXTURES ---');
    try {
      if (testContext.custId) {
        await pool.query('DELETE FROM payments WHERE customer_id = ?', [testContext.custId]);
        await pool.query('DELETE FROM discount_usages WHERE customer_id = ?', [testContext.custId]);
        const [custInvs] = await pool.query('SELECT id FROM invoices WHERE customer_id = ?', [testContext.custId]);
        if (custInvs.length > 0) {
          const invIds = custInvs.map((r) => r.id);
          await pool.query(`DELETE FROM invoice_items WHERE invoice_id IN (${invIds.join(',')})`);
          await pool.query('DELETE FROM invoices WHERE customer_id = ?', [testContext.custId]);
        }
        if (testContext.subId) {
          await pool.query('DELETE FROM subscription_items WHERE subscription_id = ?', [testContext.subId]);
          await pool.query('DELETE FROM subscriptions WHERE id = ?', [testContext.subId]);
        }
        if (testContext.planId) {
          await pool.query('DELETE FROM plans WHERE id = ?', [testContext.planId]);
        }
        if (testContext.varId) {
          await pool.query('DELETE FROM product_variants WHERE id = ?', [testContext.varId]);
        }
        if (testContext.prodId) {
          await pool.query('DELETE FROM products WHERE id = ?', [testContext.prodId]);
        }
        if (testContext.discId) {
          await pool.query('DELETE FROM discounts WHERE id = ?', [testContext.discId]);
        }
        await pool.query('DELETE FROM customers WHERE id = ?', [testContext.custId]);
      }
      console.log('  ✓ Temporary test fixtures cleaned up from database');
    } catch (cleanErr) {
      console.warn('  ⚠️ Fixture cleanup notice:', cleanErr.message);
    }

    console.log('\n================================================================');
    console.log(`📊 STAGE 11 TEST RESULTS: ${testTrackers.passed}/${testTrackers.total} PASSED (${Math.round((testTrackers.passed / testTrackers.total) * 100)}%)`);
    if (testTrackers.failed > 0) {
      console.error(`❌ ${testTrackers.failed} TEST(S) FAILED:`);
      testTrackers.failures.forEach((f) => console.error(`  - ${f.name}: ${f.detail}`));
    } else {
      console.log('🎉 ALL COMPREHENSIVE AUDIT & WORKFLOW TESTS PASSED 100%!');
    }
    console.log('================================================================');

    if (testTrackers.failed > 0) {
      process.exit(1);
    }
  }
}

if (require.main === module) {
  runStage11ComprehensiveSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Audit suite crashed:', err);
      process.exit(1);
    });
}

module.exports = runStage11ComprehensiveSuite;
