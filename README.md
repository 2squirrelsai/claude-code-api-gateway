# Claude API Gateway

A robust API gateway for Claude CLI with queuing, caching, deduplication, and monitoring capabilities.

![Tests](https://img.shields.io/badge/tests-15%20passing-brightgreen)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Job Queue**: Bull-based queue with configurable concurrency and retry logic
- **Response Caching**: Redis-backed cache with TTL support
- **Request Deduplication**: Prevents duplicate in-flight requests
- **MCP Integration**: Automatic routing to appropriate MCP servers based on query intent
- **Webhook Delivery**: Async result delivery with retry support
- **Prometheus Metrics**: Full observability with custom metrics
- **Admin Dashboard**: Web UI for queue and cache management
- **Docker Ready**: Production-ready Docker Compose setup

## Quick Start

### Prerequisites

- Node.js 18+
- Redis 6+
- Claude CLI installed and authenticated

### Installation

```bash
# Clone and install
git clone <repository-url>
cd claude-api-gateway
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development server
npm run dev
```

### Docker Deployment

```bash
# Start all services
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

## API Usage

### Submit a Query

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is 2+2?",
    "webhookUrl": "https://your-webhook.com/callback",
    "priority": "normal"
  }'
```

Response:
```json
{
  "requestId": "uuid-here",
  "status": "queued",
  "jobId": "job-id-here"
}
```

### Check Job Status

```bash
curl http://localhost:3000/api/query/{jobId}
```

Response:
```json
{
  "jobId": "job-id",
  "state": "completed",
  "progress": 100,
  "result": { "response": "4", "format": "text" }
}
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/query` | POST | Submit a new query |
| `/api/query/:jobId` | GET | Get job status/result |
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics |
| `/admin` | GET | Admin dashboard |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `REDIS_HOST` | 127.0.0.1 | Redis host |
| `REDIS_PORT` | 6379 | Redis port |
| `QUEUE_CONCURRENCY` | 5 | Max concurrent jobs |
| `CACHE_TTL` | 3600 | Cache TTL in seconds |
| `CLAUDE_TIMEOUT` | 120000 | Claude CLI timeout (ms) |
| `METRICS_ENABLED` | false | Enable Prometheus metrics |
| `ADMIN_ENABLED` | false | Enable admin dashboard |
| `MCP_ENABLED` | false | Enable MCP routing |
| `DEDUP_ENABLED` | false | Enable deduplication |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   HTTP Client   │────▶│   API Gateway   │────▶│   Bull Queue    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────┐          ┌─────────────┐
                        │    Redis    │◀─────────│  Processor  │
                        │  (Cache)    │          │  (Claude)   │
                        └─────────────┘          └─────────────┘
                                                        │
                                                        ▼
                                                 ┌─────────────┐
                                                 │   Webhook   │
                                                 └─────────────┘
```

## API Documentation

### Postman Collection

Import the Postman collection for easy API testing:

📁 **[docs/claude-api-gateway.postman_collection.json](docs/claude-api-gateway.postman_collection.json)**

The collection includes:

- Health & status endpoints
- Query submission and status checking
- Admin API with authentication
- Pre-configured variables and test scripts

**Collection Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `baseUrl` | `http://localhost:3000` | Gateway URL |
| `adminUsername` | `admin` | Admin username |
| `adminPassword` | `changeme` | Admin password |

### Request/Response Examples

**Submit Query:**

```json
POST /api/query
{
  "query": "Explain quantum computing",
  "webhookUrl": "https://webhook.site/xxx",
  "priority": "high",
  "context": { "format": "markdown" }
}
```

**Response States:**

- `queued` - Job added to queue
- `cached` - Result returned from cache
- `duplicate` - Existing in-flight job found

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/phase-checkpoints.test.js
```

## Monitoring

Access Grafana at `http://localhost:3001` (default credentials: admin/admin)

Key metrics:
- `claude_queue_size` - Current queue size by state
- `claude_jobs_completed_total` - Total completed jobs
- `claude_jobs_failed_total` - Total failed jobs
- `claude_cache_hits_total` - Cache hit count
- `claude_execution_duration_seconds` - Claude CLI execution time

## Project Structure

```text
src/
├── config/         # Environment configuration
├── routes/         # API endpoints (query, admin)
├── services/       # Core services (cache, claude, webhook, mcp, dedup)
├── queues/         # Bull queue processor and events
├── metrics/        # Prometheus metrics
├── utils/          # Logger, retry, prompt utilities
├── views/          # Admin dashboard templates
└── public/         # Static assets
```

## License

MIT
