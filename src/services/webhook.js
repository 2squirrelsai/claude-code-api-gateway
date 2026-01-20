const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');

class WebhookService {
  async deliver(url, payload, options = {}) {
    const { maxRetries = 3, timeout = 10000 } = options;

    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status}`);
        }

        logger.info('Webhook delivered', { url, status: response.status });
        return { success: true, status: response.status };
      } finally {
        clearTimeout(timeoutId);
      }
    }, { maxRetries });
  }
}

module.exports = new WebhookService();
