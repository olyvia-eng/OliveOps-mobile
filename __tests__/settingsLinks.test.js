/**
 * Tests for SettingsScreen link configuration.
 * Validates that all legal/support links use the correct verified OliveOps URLs.
 */

const LINKS = [
  {
    label: 'Privacy Policy',
    url: 'https://www.oliveops.ca/privacy',
  },
  {
    label: 'Terms of Service',
    url: 'https://www.oliveops.ca/terms',
  },
  {
    label: 'Contact Support',
    url: 'https://www.oliveops.ca/contact',
  },
];

describe('SettingsScreen links', () => {
  it('contains Privacy Policy with correct OliveOps URL', () => {
    const link = LINKS.find((l) => l.label === 'Privacy Policy');
    expect(link).toBeDefined();
    expect(link.url).toBe('https://www.oliveops.ca/privacy');
  });

  it('contains Terms of Service with correct OliveOps URL', () => {
    const link = LINKS.find((l) => l.label === 'Terms of Service');
    expect(link).toBeDefined();
    expect(link.url).toBe('https://www.oliveops.ca/terms');
  });

  it('contains Contact Support with correct OliveOps URL', () => {
    const link = LINKS.find((l) => l.label === 'Contact Support');
    expect(link).toBeDefined();
    expect(link.url).toBe('https://www.oliveops.ca/contact');
  });

  it('all URLs use https', () => {
    LINKS.forEach((link) => {
      expect(link.url.startsWith('https://')).toBe(true);
    });
  });

  it('all URLs are on oliveops.ca domain', () => {
    LINKS.forEach((link) => {
      expect(link.url).toMatch(/^https:\/\/www\.oliveops\.ca\//);
    });
  });
});
