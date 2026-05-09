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

  test('renders all five GitHub link indicators with correct hrefs', async ({ page }) => {
    await page.goto('/');

    const ghCard = page.locator('[data-tour-id="dashboard-repo-card"]').filter({
      has: page.getByRole('heading', { name: 'argus' }),
    });

    const home = ghCard.getByRole('link', { name: /open repository on github/i });
    await expect(home).toHaveAttribute('href', 'https://github.com/owner/repo');
    await expect(home).toHaveAttribute('target', '_blank');

    const branch = ghCard.getByRole('link', { name: /branch feature\/foo on github/i });
    await expect(branch).toHaveAttribute('href', 'https://github.com/owner/repo/tree/feature%2Ffoo');
    await expect(branch).toHaveAttribute('target', '_blank');

    const pr = ghCard.getByRole('link', { name: /pull requests on github/i });
    await expect(pr).toHaveAttribute(
      'href',
      'https://github.com/owner/repo/pulls?q=is%3Apr+is%3Aopen+head%3Afeature%2Ffoo',
    );

    const commits = ghCard.getByRole('link', { name: /commits on github/i });
    await expect(commits).toHaveAttribute(
      'href',
      'https://github.com/owner/repo/commits/feature%2Ffoo',
    );

    const actions = ghCard.getByRole('link', { name: /github actions/i });
    await expect(actions).toHaveAttribute(
      'href',
      'https://github.com/owner/repo/actions?query=branch%3Afeature%2Ffoo',
    );

    const issues = ghCard.getByRole('link', { name: /issues on github/i });
    await expect(issues).toHaveAttribute('href', 'https://github.com/owner/repo/issues');
  });

  test('hides all GitHub indicators on a non-GitHub remote', async ({ page }) => {
    await page.goto('/');

    const glCard = page.locator('[data-tour-id="dashboard-repo-card"]').filter({
      has: page.getByRole('heading', { name: 'gitlab-thing' }),
    });

    await expect(glCard.getByRole('link', { name: /pull requests on github/i })).toHaveCount(0);
    await expect(glCard.getByRole('link', { name: /commits on github/i })).toHaveCount(0);
    await expect(glCard.getByRole('link', { name: /github actions/i })).toHaveCount(0);
    await expect(glCard.getByRole('link', { name: /issues on github/i })).toHaveCount(0);
    await expect(glCard.getByRole('link', { name: /open repository on github/i })).toHaveCount(0);
  });
});
