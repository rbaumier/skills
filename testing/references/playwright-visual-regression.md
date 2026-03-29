# Visual Regression Testing

## Screenshot Comparisons

Use `toHaveScreenshot()` with configuration for tolerance:

```typescript
await expect(page).toHaveScreenshot('homepage.png', {
  maxDiffPixels: 50,
  threshold: 0.2,
});

// Element-level screenshots
await expect(page.getByTestId('hero-section')).toHaveScreenshot('hero.png', {
  maxDiffPixels: 10,
});
```

## Dev-Only Showcase Routes

Create isolated routes for component visual testing:

```typescript
// Only available in development
// Route: /__dev/components
test('button variants render correctly', async ({ page }) => {
  await page.goto('/__dev/components');
  await expect(page.getByTestId('button-showcase')).toHaveScreenshot('buttons.png');
});
```

This avoids testing components in context where surrounding content may cause false diffs.

## Computed Style Assertions

When pixel-perfect screenshots are too fragile, assert specific styles via `evaluate()` + `getComputedStyle()`:

```typescript
const bgColor = await page.locator('.button').evaluate(
  (el) => getComputedStyle(el).backgroundColor
);
expect(bgColor).toBe('rgb(99, 102, 241)');

const fontSize = await page.locator('h1').evaluate(
  (el) => getComputedStyle(el).fontSize
);
expect(fontSize).toBe('32px');
```

## Snapshot Update Workflow

When intentional visual changes are made:

```bash
# Update all snapshots
npx playwright test --update-snapshots

# Update snapshots for specific test file
npx playwright test visual.spec.ts --update-snapshots
```

Review updated snapshots in version control before committing.

## Cross-Browser Visual Differences

- Screenshots are stored per-project (browser): `homepage-chromium.png`, `homepage-firefox.png`
- Set `maxDiffPixels` / `threshold` high enough to tolerate font rendering differences
- Consider running visual regression on a single browser (e.g., Chromium only) to reduce noise
- Use `test.skip()` for browser-specific visual quirks that are acceptable
