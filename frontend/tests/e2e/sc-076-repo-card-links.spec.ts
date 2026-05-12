import { test, expect } from './fixtures';

test.describe('SC-076: Repo card GitHub link indicators', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/repositories', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'repo-gh',
            name: 'argus',
            path: 'C:\\projects\\argus',
            source: 'ui',
            addedAt: new Date().toISOString(),
            lastScannedAt: null,
            branch: 'feature/foo',
            remoteUrl: 'https://github.com/owner/repo',
          },
          {
            id: 'repo-gl',
            name: 'gitlab-thing',
            path: 'C:\\projects\\gitlab-thing',
            source: 'ui',
            addedAt: new Date().toISOString(),
            lastScannedAt: null,
            branch: 'feature/foo',
            remoteUrl: 'https://gitlab.com/owner/repo',
          },
        ]),
      });
    });

    await page.route('**/api/v1/sessions**', (route) => {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('renders the GitHub link indicators with correct hrefs', async ({ page }) => {
    await page.goto('/');

    const ghCard = page.locator('[data-tour-id="dashboard-repo-card"]').filter({
      has: page.getByRole('heading', { name: 'argus' }),
    });

    const home = ghCard.getByRole('link', { name: 'argus' });
    await expect(home).toHaveAttribute('href', 'https://github.com/owner/repo');
    await expect(home).toHaveAttribute('target', '_blank');

    const branch = ghCard.getByRole('link', { name: /branch feature\/foo on github/i });
    await expect(branch).toHaveAttribute('href', 'https://github.com/owner/repo/tree/feature%2Ffoo');
    await expect(branch).toHaveAttribute('target', '_blank');

    const pr = ghCard.getByRole('link', { name: /open or view pull request on github/i });
    await expect(pr).toHaveAttribute(
      'href',
      'https://github.com/owner/repo/compare/feature/foo',
    );
  });

  test('hides all GitHub indicators on a non-GitHub remote', async ({ page }) => {
    await page.goto('/');

    const glCard = page.locator('[data-tour-id="dashboard-repo-card"]').filter({
      has: page.getByRole('heading', { name: 'gitlab-thing' }),
    });

    await expect(
      glCard.getByRole('link', { name: /open or view pull request on github/i }),
    ).toHaveCount(0);
    await expect(glCard.getByRole('link', { name: 'gitlab-thing' })).toHaveCount(0);
  });
});
