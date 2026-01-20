const { Registry, Counter, Histogram, Gauge } = require('prom-client');
const config = require('../config/config');

const registry = new Registry();

// Request metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});

// Queue metrics
const jobsCompleted = new Counter({
  name: 'claude_jobs_completed_total',
  help: 'Total completed jobs',
  registers: [registry],
});

const jobsFailed = new Counter({
  name: 'claude_jobs_failed_total',
  help: 'Total failed jobs',
  registers: [registry],
});

const jobsStalled = new Counter({
  name: 'claude_jobs_stalled_total',
  help: 'Total stalled jobs',
  registers: [registry],
});

const queueSize = new Gauge({
  name: 'claude_queue_size',
  help: 'Current queue size',
  labelNames: ['state'],
  registers: [registry],
});

// Cache metrics
const cacheHits = new Counter({
  name: 'claude_cache_hits_total',
  help: 'Total cache hits',
  registers: [registry],
});

const cacheMisses = new Counter({
  name: 'claude_cache_misses_total',
  help: 'Total cache misses',
  registers: [registry],
});

// Claude execution metrics
const claudeExecutionDuration = new Histogram({
  name: 'claude_execution_duration_seconds',
  help: 'Claude CLI execution duration',
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [registry],
});

module.exports = {
  registry,
  metrics: {
    httpRequestDuration,
    httpRequestTotal,
    jobsCompleted,
    jobsFailed,
    jobsStalled,
    queueSize,
    cacheHits,
    cacheMisses,
    claudeExecutionDuration,
  },
};
