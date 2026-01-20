const config = require('../config/config');
const { detectIntent } = require('../utils/prompt');

const MCP_SERVERS = {
  database: 'sqlite',
  filesystem: 'filesystem',
  web: 'fetch',
  code: 'github',
};

class MCPRouter {
  constructor() {
    this.enabled = config.features.mcpEnabled;
  }

  getServersForQuery(query) {
    if (!this.enabled) return [];

    const intent = detectIntent(query);
    const server = MCP_SERVERS[intent];

    return server ? [server] : [];
  }

  getAllServers() {
    return Object.values(MCP_SERVERS);
  }
}

module.exports = new MCPRouter();
