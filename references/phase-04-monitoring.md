# Phase 4: Monitoring

> Load this file when working on: Prometheus metrics, Grafana, observability

## Files to Create

| File | Purpose |
|------|---------|
| `src/metrics/registry.js` | Prometheus metric definitions |
| `src/metrics/collector.js` | Periodic metric collection |
| `docker/prometheus/prometheus.yml` | Scrape configuration |
| `docker/grafana/dashboards/claude-gateway.json` | Dashboard panels |

## Metric Types

### Counters (cumulative)
- `http_requests_total{method, route, status}`
- `claude_jobs_completed_total`
- `claude_jobs_failed_total`
- `claude_cache_hits_total`
- `claude_cache_misses_total`

### Histograms (distributions)
- `http_request_duration_seconds` - buckets: 0.1, 0.5, 1, 2, 5, 10
- `claude_execution_duration_seconds` - buckets: 1, 5, 10, 30, 60, 120

### Gauges (point-in-time)
- `claude_queue_size{state}` - waiting, active, completed, failed, delayed

## Collection Pattern

```javascript
// Collect every 15 seconds
setInterval(() => {
  const counts = await queue.getJobCounts();
  metrics.queueSize.set({ state: 'waiting' }, counts.waiting);
  // ... other states
}, 15000);
```

## Prometheus Queries

```promql
# Request rate by route
rate(http_requests_total[5m])

# Job success rate
rate(claude_jobs_completed_total[5m]) /
(rate(claude_jobs_completed_total[5m]) + rate(claude_jobs_failed_total[5m]))

# Cache hit ratio
rate(claude_cache_hits_total[5m]) /
(rate(claude_cache_hits_total[5m]) + rate(claude_cache_misses_total[5m]))

# P95 execution time
histogram_quantile(0.95, rate(claude_execution_duration_seconds_bucket[5m]))
```

## Grafana Dashboard Panels

| Panel | Type | Metric |
|-------|------|--------|
| Request Rate | Graph | `rate(http_requests_total[5m])` |
| Queue Size | Graph | `claude_queue_size` |
| Success Rate | Stat | Job success calculation |
| Cache Hit Rate | Gauge | Cache ratio |
| Execution Time | Heatmap | Duration histogram |

## Validation Checklist

- [ ] `/metrics` returns Prometheus format
- [ ] Queue metrics update periodically
- [ ] Prometheus scrapes successfully
- [ ] Grafana displays data
