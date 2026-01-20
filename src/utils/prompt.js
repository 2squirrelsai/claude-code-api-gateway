const crypto = require('crypto');

function normalizeQuery(query) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function generateQueryHash(query, context = {}) {
  const normalized = normalizeQuery(query);
  const payload = JSON.stringify({ query: normalized, ...context });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function detectIntent(query) {
  const patterns = {
    database: /\b(sql|database|query|table|schema)\b/i,
    filesystem: /\b(file|folder|directory|read|write|path)\b/i,
    web: /\b(http|api|fetch|request|url)\b/i,
    code: /\b(function|class|implement|refactor|debug)\b/i,
  };

  for (const [intent, pattern] of Object.entries(patterns)) {
    if (pattern.test(query)) return intent;
  }
  return 'general';
}

module.exports = { normalizeQuery, generateQueryHash, detectIntent };
