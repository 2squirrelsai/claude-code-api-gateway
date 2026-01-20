const config = require('../config/config');
const queue = require('../queues/processor');
const cache = require('../services/cache');

async function adminRoutes(fastify) {
  // Basic auth middleware
  fastify.addHook('onRequest', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      reply.header('WWW-Authenticate', 'Basic realm="Admin"');
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (user !== config.admin.username || pass !== config.admin.password) {
      reply.code(401).send({ error: 'Invalid credentials' });
    }
  });

  // Dashboard
  fastify.get('/admin', async (request, reply) => {
    const queueCounts = await queue.getJobCounts();
    const cacheStats = await cache.getStats();
    return reply.view('dashboard.ejs', { queueCounts, cacheStats });
  });

  // Queue management
  fastify.get('/admin/queue', async (request, reply) => {
    const jobs = await queue.getJobs(['waiting', 'active', 'failed']);
    return reply.view('queue.ejs', { jobs });
  });

  fastify.post('/admin/queue/:id/retry', async (request, reply) => {
    const job = await queue.getJob(request.params.id);
    if (job) await job.retry();
    return { success: true };
  });

  fastify.delete('/admin/queue/:id', async (request, reply) => {
    const job = await queue.getJob(request.params.id);
    if (job) await job.remove();
    return { success: true };
  });

  // Cache management
  fastify.get('/admin/cache', async (request, reply) => {
    const stats = await cache.getStats();
    return reply.view('cache.ejs', { stats });
  });

  fastify.delete('/admin/cache', async (request, reply) => {
    const cleared = await cache.clear();
    return { cleared };
  });

  // API endpoints for AJAX
  fastify.get('/admin/api/stats', async () => {
    const queueCounts = await queue.getJobCounts();
    const cacheStats = await cache.getStats();
    return { queue: queueCounts, cache: cacheStats };
  });
}

module.exports = adminRoutes;
