const Redis = require('ioredis');
const config = require('../config/config');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err) => logger.error('Redis error', { error: err.message }));
    this.client.on('connect', () => logger.info('Redis connected'));
  }

  _key(hash) {
    return `${config.cache.prefix}${hash}`;
  }

  async get(hash) {
    const data = await this.client.get(this._key(hash));
    if (data) {
      logger.debug('Cache hit', { hash });
      return JSON.parse(data);
    }
    logger.debug('Cache miss', { hash });
    return null;
  }

  async set(hash, value, ttl = config.cache.ttl) {
    await this.client.setex(this._key(hash), ttl, JSON.stringify(value));
    logger.debug('Cache set', { hash, ttl });
  }

  async delete(hash) {
    await this.client.del(this._key(hash));
  }

  async getStats() {
    const info = await this.client.info('stats');
    const keys = await this.client.keys(`${config.cache.prefix}*`);
    return { totalKeys: keys.length, info };
  }

  async clear() {
    const keys = await this.client.keys(`${config.cache.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
    return keys.length;
  }
}

module.exports = new CacheService();
