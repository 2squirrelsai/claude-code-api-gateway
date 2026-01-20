const logger = require('../utils/logger');

function setupQueueEvents(queue, metrics) {
  queue.on('completed', (job, result) => {
    logger.info('Job completed', {
      jobId: job.id,
      duration: Date.now() - job.timestamp
    });
    if (metrics) metrics.jobsCompleted.inc();
  });

  queue.on('failed', (job, error) => {
    logger.error('Job failed', {
      jobId: job.id,
      error: error.message,
      attempts: job.attemptsMade
    });
    if (metrics) metrics.jobsFailed.inc();
  });

  queue.on('stalled', (job) => {
    logger.warn('Job stalled', { jobId: job.id });
    if (metrics) metrics.jobsStalled.inc();
  });

  queue.on('progress', (job, progress) => {
    logger.debug('Job progress', { jobId: job.id, progress });
  });

  queue.on('error', (error) => {
    logger.error('Queue error', { error: error.message });
  });
}

module.exports = { setupQueueEvents };
