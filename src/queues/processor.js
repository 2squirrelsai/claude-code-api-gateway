const Bull = require('bull');
const config = require('../config/config');
const logger = require('../utils/logger');
const cache = require('../services/cache');
const claude = require('../services/claude');
const webhook = require('../services/webhook');
const mcp = require('../services/mcp');
const dedup = require('../services/deduplication');
const { generateQueryHash } = require('../utils/prompt');

const queryQueue = new Bull('claude-queries', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

queryQueue.process(config.queue.concurrency, async (job) => {
  const { query, webhookUrl, context = {} } = job.data;
  const hash = generateQueryHash(query, context);

  logger.info('Processing job', { jobId: job.id, hash });

  try {
    // Check cache first
    const cached = await cache.get(hash);
    if (cached) {
      job.progress(100);
      if (webhookUrl) await webhook.deliver(webhookUrl, cached);
      return cached;
    }

    // Get MCP servers for this query
    const mcpServers = mcp.getServersForQuery(query);

    job.progress(10);

    // Execute Claude
    const result = await claude.execute(query, { mcpServers });

    job.progress(80);

    // Cache the result
    await cache.set(hash, result);

    // Clear deduplication marker
    await dedup.clearInFlight(hash);

    job.progress(90);

    // Deliver webhook if configured
    if (webhookUrl) {
      await webhook.deliver(webhookUrl, result);
    }

    job.progress(100);

    return result;
  } catch (error) {
    await dedup.clearInFlight(hash);
    logger.error('Job failed', { jobId: job.id, error: error.message });
    throw error;
  }
});

module.exports = queryQueue;
