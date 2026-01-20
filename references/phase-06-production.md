# Phase 6: Production

> Load this file when working on: Docker, deployment, security, scaling

## Files to Create

| File | Purpose |
|------|---------|
| `Dockerfile` | Application container |
| `docker/docker-compose.yml` | Full stack orchestration |
| `.dockerignore` | Build exclusions |
| `src/index.js` | Main entry with lifecycle |

## Dockerfile Pattern

```dockerfile
FROM node:20-alpine
WORKDIR /app

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Install deps first (layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src

# Run as non-root
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
```

## Docker Compose Services

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| gateway | Build | 3000 | Main application |
| redis | redis:7-alpine | - | Cache and queue backend |
| prometheus | prom/prometheus | 9090 | Metrics collection |
| grafana | grafana/grafana | 3001 | Dashboards |

## Health Check Pattern

```javascript
fastify.get('/health', async () => ({
  status: 'ok',
  timestamp: Date.now()
}));
```

Docker health check:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Graceful Shutdown

```javascript
const shutdown = async () => {
  logger.info('Shutting down...');
  await queryQueue.close();  // Finish active jobs
  await fastify.close();     // Stop accepting requests
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## Security Considerations

- Run as non-root user in container
- Use secrets for passwords (not env vars in compose)
- Enable HTTPS via reverse proxy
- Rate limit API endpoints
- Validate all input

## Scaling

- Increase `QUEUE_CONCURRENCY` for more parallel jobs
- Add replica gateway containers
- Use Redis Cluster for high availability
- Consider separate queue workers

## Validation Checklist

- [ ] `docker build` succeeds
- [ ] `docker-compose up` brings all services
- [ ] Health check returns 200
- [ ] SIGTERM triggers graceful shutdown
- [ ] Logs show proper lifecycle
