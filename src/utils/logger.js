const config = require('../config/config');

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = levels[process.env.LOG_LEVEL] || levels.info;

function formatMessage(level, message, meta = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
    env: config.env,
  });
}

module.exports = {
  error: (msg, meta) => currentLevel >= levels.error && console.error(formatMessage('error', msg, meta)),
  warn: (msg, meta) => currentLevel >= levels.warn && console.warn(formatMessage('warn', msg, meta)),
  info: (msg, meta) => currentLevel >= levels.info && console.log(formatMessage('info', msg, meta)),
  debug: (msg, meta) => currentLevel >= levels.debug && console.log(formatMessage('debug', msg, meta)),
};
