/**
 * Tests for API config — ensures production base URL is centralized and correct.
 */

// Stub process.env before importing
const ORIGINAL_ENV = process.env;

describe('API config', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('defaults to the production OliveOps API URL', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const { default: API_BASE_URL } = await import('../src/config/api.js');
    expect(API_BASE_URL).toBe('https://api.oliveops.ca');
  });

  it('respects EXPO_PUBLIC_API_URL override', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
    const { default: API_BASE_URL } = await import('../src/config/api.js');
    expect(API_BASE_URL).toBe('http://localhost:3000');
  });
});
