const { spawn } = require('child_process');
const config = require('../config/config');
const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');

class ClaudeService {
  async execute(query, options = {}) {
    const { timeout = config.claude.timeout, mcpServers = [] } = options;

    return withRetry(async () => {
      return new Promise((resolve, reject) => {
        const args = ['--print', '--output-format', 'json'];

        // Add MCP servers if specified
        mcpServers.forEach(server => {
          args.push('--mcp', server);
        });

        args.push(query);

        const proc = spawn('claude', args, {
          timeout,
          env: { ...process.env, CLAUDE_OUTPUT_FORMAT: 'json' },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data; });
        proc.stderr.on('data', (data) => { stderr += data; });

        proc.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              logger.info('Claude execution complete', { queryLength: query.length });
              resolve(result);
            } catch (e) {
              // Handle non-JSON output
              resolve({ response: stdout.trim(), format: 'text' });
            }
          } else {
            reject(new Error(`Claude exited with code ${code}: ${stderr}`));
          }
        });

        proc.on('error', reject);
      });
    }, { maxRetries: config.claude.maxRetries });
  }
}

module.exports = new ClaudeService();
