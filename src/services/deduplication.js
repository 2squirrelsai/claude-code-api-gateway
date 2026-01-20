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
