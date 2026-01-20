# Phase 2: Core Services

> Load this file when working on: Redis cache, Claude CLI, webhooks, MCP routing

## Files to Create

| File | Purpose |
|------|---------|
| `src/services/cache.js` | Redis caching with TTL |
| `src/services/claude.js` | CLI execution wrapper |
| `src/services/webhook.js` | Result delivery with retry |
| `src/services/mcp.js` | MCP server routing |
| `src/services/deduplication.js` | In-flight request tracking |

## Key Patterns

### Cache Service
- Prefix all keys with `claude:` namespace
- Use `setex` for atomic set+expire
- Return parsed JSON, not raw strings
- Log hits/misses for debugging

### Claude Service
- Spawn CLI with `--print --output-format json`
- Handle both JSON and text responses
- Pass MCP servers via `--mcp` flag
- Wrap in retry utility for resilience

### Webhook Service
- POST JSON to callback URL
- Use AbortController for timeout
- Retry on network failures
- Log delivery status

### MCP Router
- Map query intent to server names
- Intent detection via regex patterns
- Return empty array if disabled or no match

### Deduplication
- Store jobId by query hash
- Short TTL (5 min) for in-flight tracking
- Clear on job completion or failure

## Integration Points

```
Query → Hash → Dedup Check
              ↓
         Cache Check → Hit: Return
              ↓
         Miss: Queue → Claude + MCP
              ↓
         Result → Cache + Webhook
              ↓
         Clear Dedup
```

## Validation Checklist

- [ ] `cache.set()` then `cache.get()` returns same value
- [ ] `claude.execute()` returns parsed response
- [ ] `webhook.deliver()` retries on 500
- [ ] `mcp.getServersForQuery()` matches intent
- [ ] `dedup.isInFlight()` returns true after `markInFlight()`
