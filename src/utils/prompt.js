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
  // Order matters - check more specific patterns first
  const patterns = [
    ['web', /\b(http|api|fetch|url|endpoint|rest|graphql)\b/i],
    ['database', /\b(sql|database|table|schema|select|insert|update|delete|join)\b/i],
    ['filesystem', /\b(file|folder|directory|path|\.txt|\.json|\.csv|\.md)\b/i],
    ['code', /\b(function|class|implement|refactor|debug|method|variable)\b/i],
  ];

  for (const [intent, pattern] of patterns) {
    if (pattern.test(query)) return intent;
  }
  return 'general';
}

module.exports = { normalizeQuery, generateQueryHash, detectIntent };
