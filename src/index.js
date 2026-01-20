const fastify = require('fastify')({ logger: true });
const path = require('path');
const config = require('./config/config');
const logger = require('./utils/logger');
const queryQueue = require('./queues/processor');
const { setupQueueEvents } = require('./queues/events');
const { registry, metrics } = require('./metrics/registry');
const { startCollector } = require('./metrics/collector');

// Register plugins
fastify.register(require('@fastify/cors'));
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});
fastify.register(require('@fastify/view'), {
  engine: { ejs: require('ejs') },
  root: path.join(__dirname, 'views'),
});

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

// Register routes
fastify.register(require('./routes/query'), { prefix: '/api' });

if (config.features.metricsEnabled) {
  fastify.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', registry.contentType);
    return registry.metrics();
  });
  startCollector(queryQueue);
}

if (config.features.adminEnabled) {
  fastify.register(require('./routes/admin'));
}

// Setup queue events
setupQueueEvents(queryQueue, metrics);

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down...');
  await queryQueue.close();
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    logger.info(`Server running on port ${config.port}`);
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
};

start();
