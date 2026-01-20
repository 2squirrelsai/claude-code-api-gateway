require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  claude: {
    timeout: parseInt(process.env.CLAUDE_TIMEOUT, 10) || 120000,
    maxRetries: parseInt(process.env.CLAUDE_MAX_RETRIES, 10) || 3,
  },

  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY, 10) || 5,
    maxJobsPerWorker: 100,
  },

  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 3600,
    prefix: 'claude:',
  },

  features: {
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    adminEnabled: process.env.ADMIN_ENABLED === 'true',
    mcpEnabled: process.env.MCP_ENABLED === 'true',
    dedupEnabled: process.env.DEDUP_ENABLED === 'true',
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'changeme',
  },
};
