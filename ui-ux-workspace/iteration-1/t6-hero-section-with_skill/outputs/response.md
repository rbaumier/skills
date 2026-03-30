# Developer Tools Hero — Skill-Informed

## Anti-Patterns Rejected

- **Centered text over dark image** — using asymmetric left-aligned layout instead
- **Bounce/elastic easing** — using `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo)
- **Glassmorphism** — no `backdrop-filter: blur()` used decoratively
- **h-screen** — using `min-height: 100dvh`
- **AI-slop copy** — no "next-gen", "unleash", "seamless", "elevate"
- **Generic fonts** — using Geist for headings, Geist Mono for code

## Design Decisions

- **Asymmetric 2-column split** — text left (55%), visual right (45%)
- **Dramatic size contrast** — headline 72px (weight 800) vs body 18px (weight 400) = 4x jump
- **Weight contrast** — 800 paired with 300, not 600/400
- **Action hierarchy** — single solid primary CTA + ghost secondary
- **`min-h-[100dvh]`** for mobile viewport safety

```html
<section style="min-height: 100dvh; background: #0c0c0f; display: grid; grid-template-columns: 55fr 45fr;
                align-items: center; gap: 64px; padding: 64px 80px; font-family: 'Geist', sans-serif;">

  <!-- Left: Text (left-aligned, NOT centered) -->
  <div>
    <p style="font-size: 14px; font-weight: 500; color: oklch(60% 0.12 250); letter-spacing: 0.08em;
              text-transform: uppercase; margin-bottom: 20px;">
      Developer Infrastructure
    </p>

    <!-- Dramatic size: 72px heading, weight 800 -->
    <h1 style="font-size: 72px; font-weight: 800; color: oklch(95% 0.005 250); line-height: 1.05;
               margin-bottom: 24px; text-wrap: balance;">
      Ship code,<br>not config files
    </h1>

    <!-- Body: 18px, weight 300 — contrast with 800 heading -->
    <p style="font-size: 18px; font-weight: 300; color: oklch(60% 0.01 250); line-height: 1.7;
              max-width: 28em; margin-bottom: 40px;">
      One CLI that handles builds, deploys, and rollbacks.
      Stop writing YAML and start shipping features.
    </p>

    <!-- Action hierarchy: 1 solid primary + 1 ghost secondary -->
    <div style="display: flex; gap: 16px; align-items: center;">
      <!-- Primary: solid bg, high contrast -->
      <a href="/signup"
        style="display: inline-flex; align-items: center; padding: 16px 32px; min-height: 48px;
               background: oklch(95% 0.005 250); color: oklch(12% 0.01 250);
               border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none;
               transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1);">
        Start Building
      </a>
      <!-- Secondary: ghost/outline -->
      <a href="/docs"
        style="display: inline-flex; align-items: center; padding: 16px 32px; min-height: 48px;
               background: transparent; color: oklch(70% 0.01 250);
               border: 1px solid oklch(30% 0.01 250); border-radius: 8px;
               font-size: 16px; font-weight: 500; text-decoration: none;
               transition: border-color 0.15s cubic-bezier(0.16, 1, 0.3, 1);">
        Read the Docs
      </a>
    </div>
  </div>

  <!-- Right: Code terminal visual (no glassmorphism) -->
  <div style="background: oklch(14% 0.01 250); border: 1px solid oklch(22% 0.01 250);
              border-radius: 12px; padding: 32px; position: relative;">
    <!-- Terminal header dots -->
    <div style="display: flex; gap: 8px; margin-bottom: 24px;">
      <div style="width: 12px; height: 12px; border-radius: 50%; background: oklch(55% 0.15 25);"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background: oklch(75% 0.15 85);"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background: oklch(70% 0.15 145);"></div>
    </div>
    <pre style="font-family: 'Geist Mono', monospace; font-size: 14px; line-height: 2; margin: 0; color: oklch(65% 0.01 250);">
<span style="color: oklch(60% 0.12 250);">$</span> <span style="color: oklch(85% 0.005 250);">npx devtools init</span>
<span style="color: oklch(65% 0.10 145);">  Config detected. Zero changes needed.</span>

<span style="color: oklch(60% 0.12 250);">$</span> <span style="color: oklch(85% 0.005 250);">npx devtools deploy</span>
<span style="color: oklch(65% 0.10 145);">  Built in 1.2s. Deployed to us-east-1.</span>
<span style="color: oklch(65% 0.10 145);">  Live at https://app.example.com</span>
    </pre>
  </div>
</section>
```

## Compliance Summary

| Rule | Implementation |
|------|---------------|
| Asymmetric, not centered | 55/45 grid, left-aligned text |
| No bounce easing | `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) |
| Action hierarchy | 1 solid primary ("Start Building") + 1 ghost secondary ("Read the Docs") |
| Dramatic size contrast | 72px / 18px = 4x ratio |
| min-h-[100dvh] | `min-height: 100dvh` used |
| Weight contrast | 800 heading / 300 body |
| No glassmorphism | Solid bg terminal card, no blur effects |
