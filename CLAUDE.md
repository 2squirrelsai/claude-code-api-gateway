# CLAUDE.md - Claude API Gateway

## Quick Reference

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (requires Redis on localhost:6379)
npm test             # Run tests
npm run docker:up    # Start full stack (gateway, redis, prometheus, grafana)
```

## Project Overview

A robust API gateway for Claude CLI with job queuing, caching, deduplication, and monitoring. Built with Fastify + Bull + Redis.

**Architecture Flow:**
```
POST /api/query → Cache Check → Dedup Check → Bull Queue → Claude CLI → Cache → Webhook
```

## Directory Structure

```
src/
├── index.js              # Server entry point (Fastify setup, plugins, routes)
├── config/config.js      # All env vars with defaults
├── routes/
│   ├── query.js          # POST/GET /api/query endpoints
│   └── admin.js          # Admin dashboard with Basic auth
├── services/
│   ├── claude.js         # Claude CLI wrapper (spawn child process)
│   ├── cache.js          # Redis caching layer
│   ├── webhook.js        # Webhook delivery with retry
│   ├── deduplication.js  # In-flight request tracking
│   └── mcp.js            # MCP server routing by query intent
├── queues/
│   ├── processor.js      # Bull queue + job processor
│   └── events.js         # Queue event handlers
├── metrics/
│   ├── registry.js       # Prometheus metric definitions
│   └── collector.js      # Queue metrics collector
├── utils/
│   ├── logger.js         # Structured JSON logging
│   ├── retry.js          # Exponential backoff utility
│   └── prompt.js         # Query hashing + intent detection
├── views/*.ejs           # Admin dashboard templates
└── public/               # Static assets (CSS, JS)
```

## Key Patterns

### Configuration
All config in `src/config/config.js`. Uses dotenv with defaults:
```javascript
const config = require('./config/config');
config.redis.host        // Redis connection
config.features.dedupEnabled  // Feature flags
```

### Services (Singletons)
All services export singleton instances:
```javascript
const cache = require('./services/cache');
await cache.get(hash);
await cache.set(hash, value, ttl);
```

### Logging
Structured JSON logging:
```javascript
const logger = require('./utils/logger');
logger.info('Message', { key: 'value' });
logger.error('Failed', { error: err.message });
```

### Retry Logic
```javascript
const { withRetry } = require('./utils/retry');
await withRetry(async () => { /* action */ }, { maxRetries: 3 });
```

### Route Pattern (Fastify)
```javascript
async function routes(fastify) {
  fastify.post('/endpoint', async (request, reply) => {
    const { field } = request.body;
    return { result: 'value' };  // Auto-JSON serialized
  });
}
module.exports = routes;
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/query` | Submit query (returns jobId) |
| GET | `/api/query/:jobId` | Get job status/result |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics (if enabled) |
| GET | `/admin` | Admin dashboard (Basic auth) |

## Environment Variables

Key settings in `.env`:
```bash
PORT=3000                    # Server port
REDIS_HOST=127.0.0.1        # Redis host
QUEUE_CONCURRENCY=5         # Parallel job limit
CACHE_TTL=3600              # Cache TTL in seconds
METRICS_ENABLED=true        # Enable /metrics endpoint
ADMIN_ENABLED=true          # Enable /admin dashboard
ADMIN_USERNAME=admin        # Admin credentials
ADMIN_PASSWORD=changeme
```

## Testing Locally

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Start server
npm run dev

# Submit a query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is 2+2?"}'

# Check job status
curl http://localhost:3000/api/query/{jobId}
```

## Code Conventions

- **No tests yet** - Jest configured but tests not written
- **Feature flags** - Gate features with `config.features.*`
- **Singleton services** - All services export instantiated classes
- **JSON logging** - Use logger, not console.log
- **Exponential backoff** - Use `withRetry()` for external calls
