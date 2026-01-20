const { metrics } = require('./registry');

async function collectQueueMetrics(queue) {
  const counts = await queue.getJobCounts();

  metrics.queueSize.set({ state: 'waiting' }, counts.waiting);
  metrics.queueSize.set({ state: 'active' }, counts.active);
  metrics.queueSize.set({ state: 'completed' }, counts.completed);
  metrics.queueSize.set({ state: 'failed' }, counts.failed);
  metrics.queueSize.set({ state: 'delayed' }, counts.delayed);
}

function startCollector(queue, intervalMs = 15000) {
  setInterval(() => collectQueueMetrics(queue), intervalMs);
  collectQueueMetrics(queue); // Initial collection
}

module.exports = { collectQueueMetrics, startCollector };
