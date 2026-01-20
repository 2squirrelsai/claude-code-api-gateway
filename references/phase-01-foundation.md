# Phase 1: Foundation

> Load this file when working on: project setup, configuration, logging, utilities

## Files to Create

| File | Purpose |
|------|---------|
| `src/config/config.js` | Environment configuration |
| `src/utils/logger.js` | Structured JSON logging |
| `src/utils/retry.js` | Exponential backoff utility |
| `src/utils/prompt.js` | Query hashing and intent detection |

## Dependencies

```bash
npm install dotenv ioredis bull prom-client uuid
```

## Key Patterns

### Config Pattern
- All values from environment with sensible defaults
- Grouped by domain (redis, claude, queue, cache, features)
- Type coercion for numeric values

### Logger Pattern
- JSON output for machine parsing
- Level filtering (error > warn > info > debug)
- Automatic timestamp and environment tagging

### Retry Pattern
- Exponential backoff: `baseDelay * 2^(attempt-1)`
- Cap at maxDelay to prevent infinite waits
- Configurable max attempts

### Query Hash Pattern
- Normalize whitespace and case
- Include context in hash for cache differentiation
- Use SHA256 truncated to 16 chars

## Validation Checklist

```javascript
// Config loads
require('./src/config/config').port // 3000

// Logger outputs JSON
require('./src/utils/logger').info('test') // {"timestamp":...}

// Retry backs off
// Attempt 1: 1s, Attempt 2: 2s, Attempt 3: 4s

// Hash is deterministic
generateQueryHash('Hello') === generateQueryHash('hello') // true (normalized)
```
