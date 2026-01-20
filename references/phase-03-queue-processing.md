# Phase 3: Queue Processing

> Load this file when working on: Bull queues, job processing, concurrency, events

## Files to Create

| File | Purpose |
|------|---------|
| `src/queues/processor.js` | Job processing with Bull |
| `src/queues/events.js` | Queue event handlers |

## Key Patterns

### Queue Configuration
```javascript
{
  attempts: 3,                    // Retry failed jobs
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,          // Keep last 100 completed
  removeOnFail: 50,               // Keep last 50 failed
}
```

### Job Processing Flow
1. Check cache first (avoid unnecessary work)
2. Get MCP servers based on query intent
3. Execute Claude CLI
4. Cache result
5. Clear deduplication marker
6. Deliver webhook if configured
7. Report progress at each step

### Concurrency Control
- `config.queue.concurrency` limits parallel jobs
- Prevents overwhelming Claude CLI
- Default: 5 concurrent jobs

### Progress Reporting
```javascript
job.progress(10);   // Started
job.progress(80);   // Claude complete
job.progress(90);   // Cached
job.progress(100);  // Done
```

### Event Handlers
| Event | Action |
|-------|--------|
| `completed` | Log duration, increment counter |
| `failed` | Log error, increment counter |
| `stalled` | Log warning, increment counter |
| `progress` | Debug log only |
| `error` | Log queue-level errors |

## Error Handling

- Catch execution errors
- Always clear dedup marker (success or failure)
- Let Bull handle retries via job options
- Log with jobId for traceability

## Validation Checklist

- [ ] Jobs process with correct concurrency
- [ ] Failed jobs retry with backoff
- [ ] Completed jobs cached
- [ ] Events fire and log correctly
