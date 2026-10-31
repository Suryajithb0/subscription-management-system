const Invoice = require('../models/Invoice');

class BillingScheduler {
  constructor() {
    this.timer = null;
    this.intervalMs = 60 * 60 * 1000; // Run once every hour by default
    this.isRunning = false;
  }

  /**
   * Start the recurring billing background timer
   */
  startScheduler(intervalMs = null) {
    if (this.timer) {
      clearInterval(this.timer);
    }

    if (intervalMs) {
      this.intervalMs = intervalMs;
    }

    console.log(`[Billing Scheduler] Initialized. Checking for due subscriptions every ${Math.round(this.intervalMs / 1000 / 60)} minutes.`);

    // Set recurring check
    this.timer = setInterval(async () => {
      await this.runBillingCycle();
    }, this.intervalMs);

    // Prevent blocking process exit during tests
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stop the recurring billing background timer
   */
  stopScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Billing Scheduler] Stopped.');
    }
  }

  /**
   * Execute one billing cycle run with error resilience
   */
  async runBillingCycle() {
    if (this.isRunning) {
      console.log('[Billing Scheduler] Previous billing cycle is still running. Skipping iteration.');
      return null;
    }

    this.isRunning = true;
    try {
      const results = await Invoice.processRecurringBilling();
      if (results.invoicesGenerated.length > 0) {
        console.log(`[Billing Scheduler] Processed ${results.processed} subscriptions. Generated ${results.invoicesGenerated.length} invoices.`);
      }
      return results;
    } catch (err) {
      console.error('[Billing Scheduler Error] Failed to execute recurring billing:', err.message);
      return { error: err.message };
    } finally {
      this.isRunning = false;
    }
  }
}

const schedulerInstance = new BillingScheduler();
module.exports = schedulerInstance;
