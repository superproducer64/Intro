module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  clearMocks: true,
  verbose: true,
  modulePathIgnorePatterns: ['<rootDir>/Intro/', '<rootDir>/mobile/'],
  haste: {
    retainAllFiles: false,
  },
  watchPathIgnorePatterns: ['<rootDir>/Intro/', '<rootDir>/mobile/'],
};
