# Claude API Gateway - User Guide

A comprehensive guide to using the Claude API Gateway for queuing, caching, and managing Claude CLI requests at scale.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [API Reference](#api-reference)
5. [Webhooks](#webhooks)
6. [Caching](#caching)
7. [Request Deduplication](#request-deduplication)
8. [MCP Integration](#mcp-integration)
9. [Admin Dashboard](#admin-dashboard)
10. [Monitoring & Metrics](#monitoring--metrics)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is Claude API Gateway?

The Claude API Gateway is a production-ready middleware layer that sits between your applications and the Claude CLI. It provides:

- **Asynchronous Processing**: Submit queries and retrieve results later
- **Intelligent Caching**: Avoid redundant Claude CLI calls for identical queries
- **Request Deduplication**: Prevent duplicate in-flight requests
- **Webhook Delivery**: Receive results automatically when processing completes
- **Queue Management**: Control concurrency and prioritize requests
- **Full Observability**: Monitor performance with Prometheus metrics

### When to Use This Gateway

| Use Case | Benefit |
|----------|---------|
| High-volume applications | Queue management prevents overload |
| Cost optimization | Caching reduces redundant API calls |
| Microservices architecture | Webhook delivery enables async patterns |
| Production deployments | Monitoring and admin tools for operations |
| Batch processing | Submit many queries, collect results later |

---

## Getting Started

### Prerequisites

Before using the gateway, ensure you have:

1. **Claude CLI** installed and authenticated
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude auth login
   ```

2. **Redis** running (for queue and cache)
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:7-alpine

   # Or install locally
   brew install redis && redis-server
   ```

3. **Node.js 18+** installed

### Quick Start

```bash
# Clone the repository
git clone https://github.com/2squirrelsai/claude-code-api-gateway.git
cd claude-code-api-gateway

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start the server
npm run dev
```

### Your First Request

```bash
# Submit a query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the capital of France?"}'

# Response
{
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "queued",
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

```bash
# Check the result (after processing)
curl http://localhost:3000/api/query/a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Response
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "state": "completed",
  "progress": 100,
  "result": {
    "response": "The capital of France is Paris.",
    "format": "text"
  },
  "error": null
}
```

---

## Core Concepts

### Request Lifecycle

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Submit     │───▶│  Cache Check │───▶│    Queue     │───▶│   Process    │
│   Query      │    │  & Dedup     │    │              │    │  (Claude)    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                           │                                        │
                           │ (cache hit)                           │
                           ▼                                        ▼
                    ┌──────────────┐                        ┌──────────────┐
                    │   Instant    │                        │    Cache     │
                    │   Response   │                        │   & Webhook  │
                    └──────────────┘                        └──────────────┘
```

### Job States

| State | Description | What to Do |
|-------|-------------|------------|
| `waiting` | Job is in queue awaiting processing | Wait and poll for status |
| `active` | Job is currently being processed | Check `progress` field |
| `completed` | Job finished successfully | Retrieve `result` field |
| `failed` | Job encountered an error | Check `error` field, consider retry |
| `delayed` | Job is scheduled for retry | Wait for automatic retry |

### Response Statuses

When submitting a query, you'll receive one of these statuses:

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `queued` | New job created | Poll for completion or await webhook |
| `cached` | Result from cache | Use `result` immediately |
| `duplicate` | Same query already processing | Poll using returned `jobId` |

---

## API Reference

### Submit Query

**Endpoint:** `POST /api/query`

**Request Body:**

```json
{
  "query": "Your question or prompt for Claude",
  "webhookUrl": "https://your-server.com/webhook",
  "priority": "normal",
  "context": {
    "key": "value"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | The prompt to send to Claude CLI |
| `webhookUrl` | string | No | URL to POST results when complete |
| `priority` | string | No | `"high"` or `"normal"` (default) |
| `context` | object | No | Additional context for cache key generation |

**Response:**

```json
{
  "requestId": "uuid",
  "status": "queued|cached|duplicate",
  "jobId": "uuid",
  "result": {}  // Only present if status is "cached"
}
```

**Examples:**

```bash
# Basic query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Explain REST APIs"}'

# High priority with webhook
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Urgent: Analyze this error log",
    "priority": "high",
    "webhookUrl": "https://myapp.com/claude-callback"
  }'

# With context for cache differentiation
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Summarize the data",
    "context": {
      "format": "bullet-points",
      "language": "spanish"
    }
  }'
```

### Get Job Status

**Endpoint:** `GET /api/query/:jobId`

**Response:**

```json
{
  "jobId": "uuid",
  "state": "waiting|active|completed|failed|delayed",
  "progress": 0-100,
  "result": {},   // Present if completed
  "error": ""     // Present if failed
}
```

**Polling Example:**

```javascript
async function waitForResult(jobId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`http://localhost:3000/api/query/${jobId}`);
    const data = await response.json();

    if (data.state === 'completed') {
      return data.result;
    }

    if (data.state === 'failed') {
      throw new Error(data.error);
    }

    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Timeout waiting for result');
}
```

### Health Check

**Endpoint:** `GET /health`

**Response:**

```json
{
  "status": "ok",
  "timestamp": 1234567890123
}
```

---

## Webhooks

### How Webhooks Work

When you provide a `webhookUrl`, the gateway will POST the result to your endpoint when processing completes.

```
Your App                    Gateway                     Claude CLI
   │                          │                             │
   │──POST /api/query────────▶│                             │
   │  (with webhookUrl)       │                             │
   │◀─────{status: queued}────│                             │
   │                          │──execute query─────────────▶│
   │                          │◀─────────result─────────────│
   │◀──POST to webhookUrl─────│                             │
   │   (with result)          │                             │
```

### Webhook Payload

The gateway sends a POST request with the following payload:

```json
{
  "response": "Claude's response text",
  "format": "text|json"
}
```

### Webhook Endpoint Example

```javascript
// Express.js webhook handler
app.post('/claude-callback', express.json(), (req, res) => {
  const { response, format } = req.body;

  console.log('Received Claude response:', response);

  // Process the result
  // ...

  res.status(200).send('OK');
});
```

### Webhook Retry Logic

If your webhook endpoint fails, the gateway retries with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1st retry | 1 second |
| 2nd retry | 2 seconds |
| 3rd retry | 4 seconds |

After 3 failed attempts, the webhook delivery is abandoned (but the job result is still available via polling).

### Webhook Best Practices

1. **Return 200 quickly** - Process asynchronously if needed
2. **Implement idempotency** - You may receive duplicate deliveries
3. **Use HTTPS** - Secure your webhook endpoints
4. **Validate payloads** - Consider adding authentication headers

---

## Caching

### How Caching Works

The gateway caches Claude responses based on a hash of:
- The normalized query (lowercased, whitespace collapsed)
- The context object (if provided)

```
Query: "What is AI?"     ──┐
                           ├──▶ Hash: "a1b2c3d4e5f6g7h8"
Context: {}              ──┘

Query: "  WHAT  is  AI? " ──┐
                            ├──▶ Hash: "a1b2c3d4e5f6g7h8" (same!)
Context: {}               ──┘

Query: "What is AI?"      ──┐
                            ├──▶ Hash: "x9y8z7w6v5u4t3s2" (different!)
Context: {format: "eli5"} ──┘
```

### Cache Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CACHE_TTL` | 3600 | Cache lifetime in seconds (1 hour) |

### Using Context for Cache Control

Use the `context` object to differentiate cache entries for the same query:

```bash
# These will have different cache keys
curl -X POST http://localhost:3000/api/query \
  -d '{"query": "Explain Docker", "context": {"audience": "beginner"}}'

curl -X POST http://localhost:3000/api/query \
  -d '{"query": "Explain Docker", "context": {"audience": "expert"}}'
```

### Cache Invalidation

To clear the cache, use the admin API:

```bash
curl -X DELETE http://localhost:3000/admin/cache \
  -u admin:changeme
```

---

## Request Deduplication

### How Deduplication Works

When enabled, the gateway tracks "in-flight" requests. If you submit a query that's already being processed, you'll receive the existing job ID instead of creating a duplicate.

```
Request 1: "Explain AI" ──▶ New job created (job-123)
Request 2: "Explain AI" ──▶ Returns job-123 (duplicate detected)
Request 3: "explain ai" ──▶ Returns job-123 (normalized match)
```

### Deduplication Response

```json
{
  "requestId": "new-uuid",
  "status": "duplicate",
  "jobId": "existing-job-id"
}
```

### Configuration

Enable deduplication in your `.env`:

```bash
DEDUP_ENABLED=true
```

### When to Use Deduplication

- **Enable** for: User-facing applications where users might double-click
- **Disable** for: Batch processing where each request should be independent

---

## MCP Integration

### What is MCP?

MCP (Model Context Protocol) allows Claude to interact with external tools and services. The gateway automatically routes queries to appropriate MCP servers based on detected intent.

### Intent Detection

The gateway analyzes queries to detect intent:

| Intent | Keywords | MCP Server |
|--------|----------|------------|
| `database` | sql, select, table, schema | sqlite |
| `filesystem` | file, directory, path, .txt | filesystem |
| `web` | http, api, fetch, url | fetch |
| `code` | function, class, implement | github |
| `general` | (no match) | (none) |

### Configuration

Enable MCP routing:

```bash
MCP_ENABLED=true
```

### Example

```bash
# This query will automatically include the sqlite MCP server
curl -X POST http://localhost:3000/api/query \
  -d '{"query": "SELECT * FROM users WHERE active = true"}'

# The gateway executes:
# claude --print --output-format json --mcp sqlite "SELECT * FROM users..."
```

---

## Admin Dashboard

### Accessing the Dashboard

Navigate to `http://localhost:3000/admin` and enter your credentials.

**Default Credentials:**
- Username: `admin`
- Password: `changeme`

> ⚠️ **Security Warning**: Change the default password in production!

### Dashboard Features

#### Queue Overview

View real-time queue statistics:
- Waiting jobs
- Active jobs
- Completed jobs
- Failed jobs

#### Job Management

- **Retry** failed jobs
- **Remove** jobs from queue
- View job details and errors

#### Cache Management

- View cache statistics
- Clear all cached responses

### Admin API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/api/stats` | GET | Get queue and cache statistics |
| `/admin/queue/:id/retry` | POST | Retry a failed job |
| `/admin/queue/:id` | DELETE | Remove a job |
| `/admin/cache` | DELETE | Clear all cache |

**Example:**

```bash
# Get statistics
curl -u admin:changeme http://localhost:3000/admin/api/stats

# Response
{
  "queue": {
    "waiting": 5,
    "active": 2,
    "completed": 150,
    "failed": 3
  },
  "cache": {
    "totalKeys": 42
  }
}
```

---

## Monitoring & Metrics

### Prometheus Metrics

Enable metrics endpoint:

```bash
METRICS_ENABLED=true
```

Access metrics at `http://localhost:3000/metrics`

### Available Metrics

#### HTTP Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_request_duration_seconds` | Histogram | Request latency |
| `http_requests_total` | Counter | Total requests |

#### Queue Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `claude_queue_size` | Gauge | Current queue size by state |
| `claude_jobs_completed_total` | Counter | Total completed jobs |
| `claude_jobs_failed_total` | Counter | Total failed jobs |
| `claude_jobs_stalled_total` | Counter | Total stalled jobs |

#### Cache Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `claude_cache_hits_total` | Counter | Cache hit count |
| `claude_cache_misses_total` | Counter | Cache miss count |

#### Claude Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `claude_execution_duration_seconds` | Histogram | CLI execution time |

### Grafana Dashboard

Access Grafana at `http://localhost:3001` (when using Docker Compose).

**Default credentials:** admin / admin

Pre-configured dashboards show:
- Request rate over time
- Queue size trends
- Job success rate
- Cache hit rate
- Claude execution time distribution

### Setting Up Alerts

Example Prometheus alert rules:

```yaml
groups:
  - name: claude-gateway
    rules:
      - alert: HighFailureRate
        expr: rate(claude_jobs_failed_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High job failure rate detected"

      - alert: QueueBacklog
        expr: claude_queue_size{state="waiting"} > 100
        for: 10m
        annotations:
          summary: "Queue backlog growing"

      - alert: LowCacheHitRate
        expr: rate(claude_cache_hits_total[1h]) / (rate(claude_cache_hits_total[1h]) + rate(claude_cache_misses_total[1h])) < 0.3
        for: 30m
        annotations:
          summary: "Cache hit rate below 30%"
```

---

## Best Practices

### Query Design

1. **Be specific** - Vague queries may produce inconsistent results
2. **Use context** - Differentiate responses for different use cases
3. **Normalize input** - The gateway normalizes, but clean input is better

### Performance Optimization

1. **Enable caching** - Significantly reduces costs and latency
2. **Use webhooks** - Avoid polling overhead for long-running queries
3. **Set appropriate concurrency** - Balance throughput vs. resource usage

```bash
# Recommended settings for production
QUEUE_CONCURRENCY=5      # Adjust based on your Claude rate limits
CACHE_TTL=3600           # 1 hour cache, adjust based on data freshness needs
DEDUP_ENABLED=true       # Prevent duplicate work
```

### Error Handling

```javascript
async function queryWithRetry(query, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Submit query
      const submitResponse = await fetch('http://localhost:3000/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const { jobId, status, result } = await submitResponse.json();

      // If cached, return immediately
      if (status === 'cached') {
        return result;
      }

      // Poll for result
      return await waitForResult(jobId);

    } catch (error) {
      lastError = error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  throw lastError;
}
```

### Security

1. **Change admin password** - Never use defaults in production
2. **Use HTTPS** - Especially for webhook endpoints
3. **Limit access** - Use firewall rules or reverse proxy
4. **Rotate credentials** - Update admin password periodically

---

## Troubleshooting

### Common Issues

#### Jobs Stuck in "waiting" State

**Symptoms:** Jobs never move to "active"

**Possible Causes:**
1. Worker not running
2. Redis connection issues
3. Concurrency set to 0

**Solutions:**
```bash
# Check Redis connection
redis-cli ping

# Check server logs
npm run docker:logs

# Verify concurrency setting
echo $QUEUE_CONCURRENCY
```

#### Jobs Failing Immediately

**Symptoms:** Jobs move to "failed" quickly

**Possible Causes:**
1. Claude CLI not installed
2. Claude not authenticated
3. Invalid query format

**Solutions:**
```bash
# Test Claude CLI directly
claude --print "Hello"

# Check authentication
claude auth status

# Check job error message
curl http://localhost:3000/api/query/{jobId}
```

#### Cache Not Working

**Symptoms:** Same queries always hit Claude

**Possible Causes:**
1. Different context objects
2. Whitespace differences
3. Cache TTL expired

**Solutions:**
```bash
# Check cache keys
redis-cli KEYS "claude:*"

# Verify cache TTL
echo $CACHE_TTL
```

#### Webhooks Not Receiving Callbacks

**Symptoms:** Webhook endpoint never called

**Possible Causes:**
1. Webhook URL unreachable from gateway
2. HTTPS certificate issues
3. Firewall blocking outbound requests

**Solutions:**
```bash
# Test webhook URL from gateway server
curl -X POST https://your-webhook.com/test

# Check server logs for webhook errors
npm run docker:logs | grep -i webhook
```

### Getting Help

1. **Check logs:** `npm run docker:logs` or console output
2. **Review configuration:** Verify `.env` settings
3. **Test components:** Test Redis, Claude CLI independently
4. **Open an issue:** [GitHub Issues](https://github.com/2squirrelsai/claude-code-api-gateway/issues)

---

## Quick Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `REDIS_HOST` | 127.0.0.1 | Redis host |
| `REDIS_PORT` | 6379 | Redis port |
| `REDIS_PASSWORD` | - | Redis password |
| `QUEUE_CONCURRENCY` | 5 | Max concurrent jobs |
| `CACHE_TTL` | 3600 | Cache TTL (seconds) |
| `CLAUDE_TIMEOUT` | 120000 | CLI timeout (ms) |
| `CLAUDE_MAX_RETRIES` | 3 | CLI retry attempts |
| `METRICS_ENABLED` | false | Enable /metrics |
| `ADMIN_ENABLED` | false | Enable /admin |
| `MCP_ENABLED` | false | Enable MCP routing |
| `DEDUP_ENABLED` | false | Enable deduplication |
| `ADMIN_USERNAME` | admin | Admin username |
| `ADMIN_PASSWORD` | changeme | Admin password |

### API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/query` | POST | No | Submit query |
| `/api/query/:id` | GET | No | Get job status |
| `/health` | GET | No | Health check |
| `/metrics` | GET | No | Prometheus metrics |
| `/admin` | GET | Basic | Admin dashboard |
| `/admin/api/stats` | GET | Basic | Queue/cache stats |
| `/admin/queue/:id/retry` | POST | Basic | Retry job |
| `/admin/queue/:id` | DELETE | Basic | Remove job |
| `/admin/cache` | DELETE | Basic | Clear cache |

---

*Last updated: January 2025*
