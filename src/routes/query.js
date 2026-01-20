const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const cache = require('../services/cache');
const queue = require('../queues/processor');
const dedup = require('../services/deduplication');
const { generateQueryHash } = require('../utils/prompt');

async function queryRoutes(fastify) {
  // Submit query
  fastify.post('/query', async (request, reply) => {
    const { query, webhookUrl, context = {}, priority = 'normal' } = request.body;

    if (!query) {
      return reply.code(400).send({ error: 'Query is required' });
    }

    const hash = generateQueryHash(query, context);
    const requestId = uuidv4();

    // Check cache
    const cached = await cache.get(hash);
    if (cached) {
      return { requestId, status: 'cached', result: cached };
    }

    // Check deduplication
    if (config.features.dedupEnabled) {
      const existingJobId = await dedup.getJobId(hash);
      if (existingJobId) {
        return { requestId, status: 'duplicate', jobId: existingJobId };
      }
    }

    // Add to queue
    const job = await queue.add({ query, webhookUrl, context }, {
      priority: priority === 'high' ? 1 : 10,
      jobId: requestId,
    });

    // Mark as in-flight
    if (config.features.dedupEnabled) {
      await dedup.markInFlight(hash, job.id);
    }

    return { requestId, status: 'queued', jobId: job.id };
  });

  // Get job status
  fastify.get('/query/:jobId', async (request, reply) => {
    const job = await queue.getJob(request.params.jobId);

    if (!job) {
      return reply.code(404).send({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      jobId: job.id,
      state,
      progress,
      result: state === 'completed' ? job.returnvalue : null,
      error: state === 'failed' ? job.failedReason : null,
    };
  });
}

module.exports = queryRoutes;
