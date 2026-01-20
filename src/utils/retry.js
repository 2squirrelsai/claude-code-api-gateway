const logger = require('./logger');

async function withRetry(fn, options = {}) {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 30000 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      logger.warn(`Retry attempt ${attempt}/${maxRetries}`, { delay, error: error.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = { withRetry };
