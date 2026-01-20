# Claude API Gateway - Optimized Development Workflow

> **Purpose**: A phased implementation guide using context-window optimization techniques. Each phase is self-contained, loading only what's needed for that stage of development.

---

## How This Workflow Saves Context

Instead of loading the entire 200-line guide upfront (~4,000 tokens), this workflow:

1. **Indexes phases** - Start with just the phase you need (~100-150 tokens)
2. **On-demand loading** - Reference files contain only phase-specific code
3. **Captures insights** - Learnings from each phase inform future sessions

**Result**: ~85% token reduction per session while maintaining full implementation guidance.

---

## Phase Index

| Phase | Focus | Files Created | Est. Time |
|-------|-------|---------------|-----------|
| [1](#phase-1-foundation) | Setup & Config | 4 files | 15 min |
| [2](#phase-2-core-services) | Redis, Claude, Webhooks | 5 files | 25 min |
| [3](#phase-3-queue-processing) | Bull Queues, Dedup | 3 files | 20 min |
| [4](#phase-4-monitoring) | Prometheus, Grafana | 3 files | 20 min |
| [5](#phase-5-admin-dashboard) | Web UI | 6 files | 25 min |
| [6](#phase-6-production) | Docker, Deploy | 4 files | 15 min |

---

## Phase 1: Foundation

**Goal**: Project structure, configuration, and utilities

### Files to Create

```
src/
├── config/config.js      # Environment configuration
├── utils/
│   ├── logger.js         # Structured logging
│   ├── retry.js          # Exponential backoff
│   └── prompt.js         # Query preprocessing
└── index.js              # Main entry (skeleton)
```

### 1.1 Configuration (`src/config/config.js`)

```javascript
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
```

### 1.2 Logger (`src/utils/logger.js`)

```javascript
const config = require('../config/config');

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = levels[process.env.LOG_LEVEL] || levels.info;

function formatMessage(level, message, meta = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
    env: config.env,
  });
}

module.exports = {
  error: (msg, meta) => currentLevel >= levels.error && console.error(formatMessage('error', msg, meta)),
  warn: (msg, meta) => currentLevel >= levels.warn && console.warn(formatMessage('warn', msg, meta)),
  info: (msg, meta) => currentLevel >= levels.info && console.log(formatMessage('info', msg, meta)),
  debug: (msg, meta) => currentLevel >= levels.debug && console.log(formatMessage('debug', msg, meta)),
};
```

### 1.3 Retry Utility (`src/utils/retry.js`)

```javascript
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
```

### 1.4 Prompt Utility (`src/utils/prompt.js`)

```javascript
const crypto = require('crypto');

function normalizeQuery(query) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function generateQueryHash(query, context = {}) {
  const normalized = normalizeQuery(query);
  const payload = JSON.stringify({ query: normalized, ...context });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function detectIntent(query) {
  const patterns = {
    database: /\b(sql|database|query|table|schema)\b/i,
    filesystem: /\b(file|folder|directory|read|write|path)\b/i,
    web: /\b(http|api|fetch|request|url)\b/i,
    code: /\b(function|class|implement|refactor|debug)\b/i,
  };

  for (const [intent, pattern] of Object.entries(patterns)) {
    if (pattern.test(query)) return intent;
  }
  return 'general';
}

module.exports = { normalizeQuery, generateQueryHash, detectIntent };
```

### Phase 1 Checkpoint
- [ ] All config values load from environment
- [ ] Logger outputs valid JSON
- [ ] Retry utility handles exponential backoff
- [ ] Query hash is deterministic

---

## Phase 2: Core Services

**Goal**: Cache, Claude CLI integration, webhooks, and MCP routing

### Files to Create

```
src/services/
├── cache.js           # Redis caching layer
├── claude.js          # CLI execution wrapper
├── webhook.js         # Result delivery
├── mcp.js             # MCP server routing
└── deduplication.js   # In-flight request tracking
```

### 2.1 Cache Service (`src/services/cache.js`)

```javascript
const Redis = require('ioredis');
const config = require('../config/config');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err) => logger.error('Redis error', { error: err.message }));
    this.client.on('connect', () => logger.info('Redis connected'));
  }

  _key(hash) {
    return `${config.cache.prefix}${hash}`;
  }

  async get(hash) {
    const data = await this.client.get(this._key(hash));
    if (data) {
      logger.debug('Cache hit', { hash });
      return JSON.parse(data);
    }
    logger.debug('Cache miss', { hash });
    return null;
  }

  async set(hash, value, ttl = config.cache.ttl) {
    await this.client.setex(this._key(hash), ttl, JSON.stringify(value));
    logger.debug('Cache set', { hash, ttl });
  }

  async delete(hash) {
    await this.client.del(this._key(hash));
  }

  async getStats() {
    const info = await this.client.info('stats');
    const keys = await this.client.keys(`${config.cache.prefix}*`);
    return { totalKeys: keys.length, info };
  }

  async clear() {
    const keys = await this.client.keys(`${config.cache.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
    return keys.length;
  }
}

module.exports = new CacheService();
```

### 2.2 Claude Service (`src/services/claude.js`)

```javascript
const { spawn } = require('child_process');
const config = require('../config/config');
const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');

class ClaudeService {
  async execute(query, options = {}) {
    const { timeout = config.claude.timeout, mcpServers = [] } = options;

    return withRetry(async () => {
      return new Promise((resolve, reject) => {
        const args = ['--print', '--output-format', 'json'];

        // Add MCP servers if specified
        mcpServers.forEach(server => {
          args.push('--mcp', server);
        });

        args.push(query);

        const proc = spawn('claude', args, {
          timeout,
          env: { ...process.env, CLAUDE_OUTPUT_FORMAT: 'json' },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data; });
        proc.stderr.on('data', (data) => { stderr += data; });

        proc.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              logger.info('Claude execution complete', { queryLength: query.length });
              resolve(result);
            } catch (e) {
              // Handle non-JSON output
              resolve({ response: stdout.trim(), format: 'text' });
            }
          } else {
            reject(new Error(`Claude exited with code ${code}: ${stderr}`));
          }
        });

        proc.on('error', reject);
      });
    }, { maxRetries: config.claude.maxRetries });
  }
}

module.exports = new ClaudeService();
```

### 2.3 Webhook Service (`src/services/webhook.js`)

```javascript
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
```

### 2.4 MCP Router (`src/services/mcp.js`)

```javascript
const config = require('../config/config');
const { detectIntent } = require('../utils/prompt');

const MCP_SERVERS = {
  database: 'sqlite',
  filesystem: 'filesystem',
  web: 'fetch',
  code: 'github',
};

class MCPRouter {
  constructor() {
    this.enabled = config.features.mcpEnabled;
  }

  getServersForQuery(query) {
    if (!this.enabled) return [];

    const intent = detectIntent(query);
    const server = MCP_SERVERS[intent];

    return server ? [server] : [];
  }

  getAllServers() {
    return Object.values(MCP_SERVERS);
  }
}

module.exports = new MCPRouter();
```

### 2.5 Deduplication Service (`src/services/deduplication.js`)

```javascript
const Redis = require('ioredis');
const config = require('../config/config');
const logger = require('../utils/logger');

class DeduplicationService {
  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    });
    this.prefix = 'dedup:';
    this.ttl = 300; // 5 minutes for in-flight tracking
  }

  async isInFlight(hash) {
    const exists = await this.client.exists(`${this.prefix}${hash}`);
    return exists === 1;
  }

  async markInFlight(hash, jobId) {
    await this.client.setex(`${this.prefix}${hash}`, this.ttl, jobId);
    logger.debug('Marked in-flight', { hash, jobId });
  }

  async clearInFlight(hash) {
    await this.client.del(`${this.prefix}${hash}`);
    logger.debug('Cleared in-flight', { hash });
  }

  async getJobId(hash) {
    return this.client.get(`${this.prefix}${hash}`);
  }
}

module.exports = new DeduplicationService();
```

### Phase 2 Checkpoint
- [ ] Cache reads/writes work with Redis
- [ ] Claude CLI executes and parses output
- [ ] Webhooks retry on failure
- [ ] MCP routing matches query intent
- [ ] Deduplication tracks in-flight requests

---

## Phase 3: Queue Processing

**Goal**: Bull queue setup, job processor, and event handling

### Files to Create

```
src/queues/
├── processor.js    # Job processing logic
└── events.js       # Queue event handlers
```

### 3.1 Job Processor (`src/queues/processor.js`)

```javascript
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
```

### 3.2 Queue Events (`src/queues/events.js`)

```javascript
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
```

### Phase 3 Checkpoint
- [ ] Jobs enqueue successfully
- [ ] Processor respects concurrency limit
- [ ] Failed jobs retry with backoff
- [ ] Events log appropriately

---

## Phase 4: Monitoring

**Goal**: Prometheus metrics and Grafana dashboards

### Files to Create

```
src/metrics/
├── registry.js     # Prometheus registry
└── collector.js    # Custom collectors
docker/
├── prometheus/prometheus.yml
└── grafana/dashboards/claude-gateway.json
```

### 4.1 Metrics Registry (`src/metrics/registry.js`)

```javascript
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
```

### 4.2 Metrics Collector (`src/metrics/collector.js`)

```javascript
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
```

### 4.3 Prometheus Config (`docker/prometheus/prometheus.yml`)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'claude-gateway'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/metrics'

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
```

### 4.4 Grafana Dashboard (`docker/grafana/dashboards/claude-gateway.json`)

```json
{
  "dashboard": {
    "title": "Claude API Gateway",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          { "expr": "rate(http_requests_total[5m])", "legendFormat": "{{method}} {{route}}" }
        ]
      },
      {
        "title": "Queue Size",
        "type": "graph",
        "targets": [
          { "expr": "claude_queue_size", "legendFormat": "{{state}}" }
        ]
      },
      {
        "title": "Job Success Rate",
        "type": "stat",
        "targets": [
          { "expr": "rate(claude_jobs_completed_total[5m]) / (rate(claude_jobs_completed_total[5m]) + rate(claude_jobs_failed_total[5m]))" }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "type": "gauge",
        "targets": [
          { "expr": "rate(claude_cache_hits_total[5m]) / (rate(claude_cache_hits_total[5m]) + rate(claude_cache_misses_total[5m]))" }
        ]
      },
      {
        "title": "Claude Execution Time",
        "type": "heatmap",
        "targets": [
          { "expr": "rate(claude_execution_duration_seconds_bucket[5m])" }
        ]
      }
    ]
  }
}
```

### Phase 4 Checkpoint
- [ ] Metrics endpoint returns Prometheus format
- [ ] Queue metrics update every 15s
- [ ] Grafana can scrape and display metrics

---

## Phase 5: Admin Dashboard

**Goal**: Web-based management interface

### Files to Create

```
src/routes/admin.js
src/views/
├── dashboard.ejs
├── queue.ejs
└── cache.ejs
src/public/
├── css/style.css
└── js/
    ├── dashboard.js
    ├── queue.js
    └── cache.js
```

### 5.1 Admin Routes (`src/routes/admin.js`)

```javascript
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
```

### 5.2 Dashboard Template (`src/views/dashboard.ejs`)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Claude Gateway Admin</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav>
    <a href="/admin">Dashboard</a>
    <a href="/admin/queue">Queue</a>
    <a href="/admin/cache">Cache</a>
  </nav>

  <main>
    <h1>Dashboard</h1>

    <section class="stats-grid">
      <div class="stat-card">
        <h3>Queue</h3>
        <p>Waiting: <span id="waiting"><%= queueCounts.waiting %></span></p>
        <p>Active: <span id="active"><%= queueCounts.active %></span></p>
        <p>Completed: <span id="completed"><%= queueCounts.completed %></span></p>
        <p>Failed: <span id="failed"><%= queueCounts.failed %></span></p>
      </div>

      <div class="stat-card">
        <h3>Cache</h3>
        <p>Keys: <span id="cacheKeys"><%= cacheStats.totalKeys %></span></p>
      </div>
    </section>
  </main>

  <script src="/js/dashboard.js"></script>
</body>
</html>
```

### 5.3 Styles (`src/public/css/style.css`)

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f5f5f5; }
nav { background: #333; padding: 1rem; }
nav a { color: white; margin-right: 1rem; text-decoration: none; }
main { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
h1 { margin-bottom: 1.5rem; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
.stat-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.stat-card h3 { margin-bottom: 1rem; color: #333; }
.stat-card p { margin: 0.5rem 0; }
button { background: #007bff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
button:hover { background: #0056b3; }
button.danger { background: #dc3545; }
table { width: 100%; border-collapse: collapse; background: white; }
th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #ddd; }
```

### 5.4 Dashboard JS (`src/public/js/dashboard.js`)

```javascript
async function refreshStats() {
  try {
    const res = await fetch('/admin/api/stats');
    const data = await res.json();

    document.getElementById('waiting').textContent = data.queue.waiting;
    document.getElementById('active').textContent = data.queue.active;
    document.getElementById('completed').textContent = data.queue.completed;
    document.getElementById('failed').textContent = data.queue.failed;
    document.getElementById('cacheKeys').textContent = data.cache.totalKeys;
  } catch (e) {
    console.error('Failed to refresh stats', e);
  }
}

setInterval(refreshStats, 5000);
```

### Phase 5 Checkpoint
- [ ] Admin routes require authentication
- [ ] Dashboard displays live stats
- [ ] Queue jobs can be retried/removed
- [ ] Cache can be cleared

---

## Phase 6: Production

**Goal**: Docker deployment, security, and scaling

### Files to Create

```
docker/docker-compose.yml
Dockerfile
.dockerignore
```

### 6.1 Docker Compose (`docker/docker-compose.yml`)

```yaml
version: '3.8'

services:
  gateway:
    build: ..
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - METRICS_ENABLED=true
      - ADMIN_ENABLED=true
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - "9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  redis_data:
  prometheus_data:
  grafana_data:
```

### 6.2 Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

USER node

EXPOSE 3000

CMD ["node", "src/index.js"]
```

### 6.3 Main Entry (`src/index.js`)

```javascript
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
```

### 6.4 Query Routes (`src/routes/query.js`)

```javascript
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
```

### Phase 6 Checkpoint
- [ ] Docker build succeeds
- [ ] Compose brings up all services
- [ ] Health check returns OK
- [ ] Graceful shutdown works

---

## Session Insights Template

After each session, capture learnings here:

```markdown
### Session: [Date]
**Phase worked on**: [1-6]
**Key insight**:
**Issue encountered**:
**Resolution**:
**Should generalize?**: [Yes/No]
```

---

## Quick Commands

```bash
# Development
npm run dev

# Production
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose logs -f gateway

# Test query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is 2+2?"}'

# Check metrics
curl http://localhost:3000/metrics

# Admin dashboard
open http://localhost:3000/admin
```
