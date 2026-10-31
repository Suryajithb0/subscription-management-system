const assert = require('assert');
const { pool } = require('../config/db');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');

async function testProductModule() {
  console.log('====================================================');
  console.log('🧪 Starting Stage 05: Product & Variant Automated Tests');
  console.log('====================================================');

  try {
    // 1. Clean up any previous test products
    await pool.execute("DELETE FROM products WHERE name LIKE 'TEST_PRODUCT_%'");

    // Test 1: Product creation
    console.log('\n[Test 1/12] Creating a new product...');
    const prodId = await Product.create({
      name: 'TEST_PRODUCT_CRM_PLATFORM',
      description: 'Enterprise Cloud CRM Platform',
      product_type: 'software',
      sales_price: 199.99,
      cost_price: 49.99,
      notes: 'Initial test setup note',
      is_active: true,
    });
    assert(prodId > 0, 'Product creation should return valid ID');
    console.log('  ✓ PASSED: Created product with ID:', prodId);

    // Test 2: Product lookup by ID
    console.log('\n[Test 2/12] Finding product by ID...');
    const product = await Product.findById(prodId);
    assert.strictEqual(product.name, 'TEST_PRODUCT_CRM_PLATFORM');
    assert.strictEqual(product.sales_price, 199.99);
    assert.strictEqual(product.cost_price, 49.99);
    console.log('  ✓ PASSED: Product data retrieved accurately');

    // Test 3: Product listing with search & filters
    console.log('\n[Test 3/12] Listing products with search & type filter...');
    const searchRes = await Product.findAll({ search: 'CRM_PLATFORM', product_type: 'software' });
    assert(searchRes.products.length >= 1, 'Search query should return the created product');
    assert.strictEqual(searchRes.pagination.total >= 1, true);
    console.log('  ✓ PASSED: Product search and pagination functioning');

    // Test 4: Product update
    console.log('\n[Test 4/12] Updating product fields...');
    const updated = await Product.update(prodId, {
      name: 'TEST_PRODUCT_CRM_PLATFORM_V2',
      sales_price: 249.99,
      cost_price: 59.99,
      notes: 'Updated note',
      is_active: true,
    });
    assert(updated, 'Product update should return true');
    const reloaded = await Product.findById(prodId);
    assert.strictEqual(reloaded.sales_price, 249.99);
    assert.strictEqual(reloaded.name, 'TEST_PRODUCT_CRM_PLATFORM_V2');
    console.log('  ✓ PASSED: Product updated successfully');

    // Test 5: Status toggle (PATCH)
    console.log('\n[Test 5/12] Deactivating product (status toggle)...');
    await Product.setStatus(prodId, false);
    const deactivated = await Product.findById(prodId);
    assert.strictEqual(deactivated.is_active, 0);
    console.log('  ✓ PASSED: Status toggled to inactive');

    await Product.setStatus(prodId, true);
    const reactivated = await Product.findById(prodId);
    assert.strictEqual(reactivated.is_active, 1);
    console.log('  ✓ PASSED: Status reactivated to active');

    // Test 6: Variant creation
    console.log('\n[Test 6/12] Creating variants for product...');
    const var1Id = await ProductVariant.create({
      productId: prodId,
      variant_name: 'Brand',
      variant_value: 'Odoo Edition',
      additional_price: 560.00,
    });
    const var2Id = await ProductVariant.create({
      productId: prodId,
      variant_name: 'Brand',
      variant_value: 'Zoho Edition',
      additional_price: 300.00,
    });
    const var3Id = await ProductVariant.create({
      productId: prodId,
      variant_name: 'Brand',
      variant_value: 'Standard Edition',
      additional_price: 0.00,
    });
    assert(var1Id > 0 && var2Id > 0 && var3Id > 0, 'Variants should return valid IDs');
    console.log('  ✓ PASSED: Created 3 variants for product ID:', prodId);

    // Test 7: Variant listing & price calculation
    console.log('\n[Test 7/12] Verifying variant list and effective price calculation...');
    const variants = await ProductVariant.findByProductId(prodId);
    assert.strictEqual(variants.length, 3);
    const odooVariant = variants.find(v => v.variant_value === 'Odoo Edition');
    const finalPrice = reloaded.sales_price + odooVariant.additional_price;
    assert.strictEqual(finalPrice, 249.99 + 560.00); // 809.99
    console.log('  ✓ PASSED: Final calculated variant price:', finalPrice);

    // Test 8: Variant update
    console.log('\n[Test 8/12] Updating variant...');
    const varUpdated = await ProductVariant.update(var1Id, prodId, {
      variant_name: 'Brand',
      variant_value: 'Odoo Enterprise',
      additional_price: 600.00,
    });
    assert(varUpdated, 'Variant update should succeed');
    const reloadedVar = await ProductVariant.findById(var1Id, prodId);
    assert.strictEqual(reloadedVar.variant_value, 'Odoo Enterprise');
    assert.strictEqual(reloadedVar.additional_price, 600.00);
    console.log('  ✓ PASSED: Variant updated successfully');

    // Test 9: Variant deletion
    console.log('\n[Test 9/12] Deleting single variant...');
    const deletedVar = await ProductVariant.delete(var3Id, prodId);
    assert(deletedVar, 'Variant deletion should succeed');
    const remainingVars = await ProductVariant.findByProductId(prodId);
    assert.strictEqual(remainingVars.length, 2);
    console.log('  ✓ PASSED: Variant deleted and remaining count verified');

    // Test 10: Variant ownership check
    console.log('\n[Test 10/12] Verifying variant ownership isolation...');
    const fakeProductVariant = await ProductVariant.findById(var1Id, 999999);
    assert.strictEqual(fakeProductVariant, null, 'Variant should not be found with incorrect product_id');
    console.log('  ✓ PASSED: Cross-product variant isolation enforced');

    // Test 11: Deletion with historical references test
    console.log('\n[Test 11/12] Testing historical references and deactivation preference...');
    // Create a plan linking to this product to simulate historical usage
    const [planRes] = await pool.execute(
      `INSERT INTO plans (product_id, name, code, billing_interval, price) VALUES (?, ?, ?, 'month', 99.00)`,
      [prodId, 'Temporary Test Plan', `PLAN-TEST-${Date.now()}`]
    );
    const hasRefs = await Product.hasReferences(prodId);
    assert.strictEqual(hasRefs, true, 'Product should detect linked plans');

    // Clean up test plan
    await pool.execute(`DELETE FROM plans WHERE id = ?`, [planRes.insertId]);
    console.log('  ✓ PASSED: Historical reference detection verified');

    // Test 12: Permanent deletion of standalone product
    console.log('\n[Test 12/12] Clean permanent deletion of unlinked product...');
    const deletedProduct = await Product.delete(prodId);
    assert(deletedProduct, 'Product delete should succeed');
    const checkProduct = await Product.findById(prodId);
    assert.strictEqual(checkProduct, null, 'Deleted product should no longer exist in database');
    const checkOrphanVariants = await ProductVariant.findByProductId(prodId);
    assert.strictEqual(checkOrphanVariants.length, 0, 'Child variants should be removed with product');
    console.log('  ✓ PASSED: Product and cascaded variants cleaned up cleanly');

    console.log('\n====================================================');
    console.log('🎉 ALL 12/12 PRODUCT & VARIANT TESTS PASSED!');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

testProductModule();
