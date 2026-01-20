/**
 * Phase Checkpoint Tests
 * Validates all checkpoints from the workflow guide
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');

// Phase 1: Foundation
describe('Phase 1: Foundation', () => {
  describe('Config', () => {
    test('loads all config values from environment', () => {
      const config = require('../src/config/config');

      expect(config.env).toBeDefined();
      expect(config.port).toBeGreaterThan(0);
      expect(config.redis.host).toBeDefined();
      expect(config.redis.port).toBeGreaterThan(0);
      expect(config.claude.timeout).toBeGreaterThan(0);
      expect(config.claude.maxRetries).toBeGreaterThan(0);
      expect(config.queue.concurrency).toBeGreaterThan(0);
      expect(config.cache.ttl).toBeGreaterThan(0);
      expect(config.cache.prefix).toBe('claude:');
      expect(typeof config.features.metricsEnabled).toBe('boolean');
      expect(typeof config.features.adminEnabled).toBe('boolean');
      expect(config.admin.username).toBeDefined();
      expect(config.admin.password).toBeDefined();
    });
  });

  describe('Logger', () => {
    test('outputs valid JSON', () => {
      const logger = require('../src/utils/logger');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('Test message', { key: 'value' });

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.timestamp).toBeDefined();
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Test message');
      expect(parsed.key).toBe('value');

      consoleSpy.mockRestore();
    });
  });

  describe('Retry Utility', () => {
    test('handles exponential backoff', async () => {
      const { withRetry } = require('../src/utils/retry');
      let attempts = 0;

      const result = await withRetry(async () => {
        attempts++;
        if (attempts < 3) throw new Error('Retry me');
        return 'success';
      }, { maxRetries: 3, baseDelay: 10 });

      expect(attempts).toBe(3);
      expect(result).toBe('success');
    });

    test('throws after max retries', async () => {
      const { withRetry } = require('../src/utils/retry');

      await expect(withRetry(async () => {
        throw new Error('Always fails');
      }, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow('Always fails');
    });
  });

  describe('Query Hash', () => {
    test('is deterministic', () => {
      const { generateQueryHash } = require('../src/utils/prompt');

      const hash1 = generateQueryHash('What is 2+2?', {});
      const hash2 = generateQueryHash('What is 2+2?', {});
      const hash3 = generateQueryHash('What is 2+2?', { context: 'math' });

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(16);
    });

    test('normalizes queries', () => {
      const { generateQueryHash } = require('../src/utils/prompt');

      const hash1 = generateQueryHash('Hello World', {});
      const hash2 = generateQueryHash('  hello   world  ', {});

      expect(hash1).toBe(hash2);
    });
  });

  describe('Intent Detection', () => {
    test('detects query intent correctly', () => {
      const { detectIntent } = require('../src/utils/prompt');

      expect(detectIntent('SELECT * FROM users')).toBe('database');
      expect(detectIntent('Read the file at /path')).toBe('filesystem');
      expect(detectIntent('Fetch data from the API')).toBe('web');
      expect(detectIntent('Implement a function')).toBe('code');
      expect(detectIntent('What is the meaning of life?')).toBe('general');
    });
  });
});

// Phase 2: Core Services
describe('Phase 2: Core Services', () => {
  describe('Cache Service', () => {
    const cache = require('../src/services/cache');

    afterAll(async () => {
      await cache.client.quit();
    });

    test('can set and get values', async () => {
      const testHash = 'test-hash-' + Date.now();
      const testValue = { response: 'test' };

      await cache.set(testHash, testValue, 60);
      const result = await cache.get(testHash);

      expect(result).toEqual(testValue);

      await cache.delete(testHash);
    });

    test('returns null for missing keys', async () => {
      const result = await cache.get('nonexistent-key');
      expect(result).toBeNull();
    });
  });

  describe('MCP Router', () => {
    test('routes queries to appropriate servers when enabled', () => {
      const mcp = require('../src/services/mcp');

      // Temporarily enable MCP for this test
      const originalEnabled = mcp.enabled;
      mcp.enabled = true;

      expect(mcp.getServersForQuery('SELECT * FROM users')).toContain('sqlite');
      expect(mcp.getServersForQuery('Read file.txt')).toContain('filesystem');
      expect(mcp.getServersForQuery('What is life?')).toEqual([]);

      // Restore original state
      mcp.enabled = originalEnabled;
    });

    test('returns empty array when disabled', () => {
      const mcp = require('../src/services/mcp');
      const originalEnabled = mcp.enabled;
      mcp.enabled = false;

      expect(mcp.getServersForQuery('SELECT * FROM users')).toEqual([]);

      mcp.enabled = originalEnabled;
    });
  });

  describe('Deduplication Service', () => {
    const dedup = require('../src/services/deduplication');

    afterAll(async () => {
      await dedup.client.quit();
    });

    test('tracks in-flight requests', async () => {
      const hash = 'dedup-test-' + Date.now();
      const jobId = 'job-123';

      expect(await dedup.isInFlight(hash)).toBe(false);

      await dedup.markInFlight(hash, jobId);
      expect(await dedup.isInFlight(hash)).toBe(true);
      expect(await dedup.getJobId(hash)).toBe(jobId);

      await dedup.clearInFlight(hash);
      expect(await dedup.isInFlight(hash)).toBe(false);
    });
  });
});

// Phase 3: Queue Processing
describe('Phase 3: Queue Processing', () => {
  let queue;

  beforeAll(() => {
    queue = require('../src/queues/processor');
  });

  afterAll(async () => {
    await queue.close();
  });

  test('queue is properly configured', () => {
    expect(queue.name).toBe('claude-queries');
  });

  test('can add jobs to queue', async () => {
    const jobId = 'test-job-' + Date.now();
    const job = await queue.add({
      query: 'Test query',
      context: {}
    }, {
      jobId,
      removeOnComplete: true,
      removeOnFail: true
    });

    expect(job.id).toBe(jobId);
    expect(job.data.query).toBe('Test query');

    // Don't try to remove - let the queue handle cleanup
  });
});

// Phase 4: Monitoring (basic check - full test needs running server)
describe('Phase 4: Monitoring', () => {
  test('metrics registry is configured', () => {
    const { registry, metrics } = require('../src/metrics/registry');

    expect(registry).toBeDefined();
    expect(metrics.httpRequestDuration).toBeDefined();
    expect(metrics.httpRequestTotal).toBeDefined();
    expect(metrics.jobsCompleted).toBeDefined();
    expect(metrics.jobsFailed).toBeDefined();
    expect(metrics.queueSize).toBeDefined();
    expect(metrics.cacheHits).toBeDefined();
    expect(metrics.cacheMisses).toBeDefined();
    expect(metrics.claudeExecutionDuration).toBeDefined();
  });
});
