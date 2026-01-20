module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
  // Ignore certain paths
  testPathIgnorePatterns: ['/node_modules/'],
  // Setup file to handle console output during tests
  setupFilesAfterEnv: ['./tests/setup.js'],
};
