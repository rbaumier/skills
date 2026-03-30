# SaaS Analytics Color System — OKLCH-Based

## Design Decisions

- **OKLCH color space** for perceptually uniform palette generation
- **Tinted neutrals** — all greys tinted toward blue brand hue (0.01 chroma at hue 250)
- **No pure black or white** — darkest is `oklch(13% 0.01 250)`, lightest is `oklch(98.5% 0.005 250)`
- **60/30/10 rule** — neutrals dominate (60%), secondary blue (30%), accent orange (10%)
- **Semantic token naming** — `{category}-{property}-{variant}-{state}` pattern

```css
:root {
  /* ─── Grey Scale (tinted toward brand blue, hue 250) ─── */
  --color-surface-base:        oklch(98.5% 0.005 250);  /* near-white, blue tint */
  --color-surface-raised:      oklch(96% 0.008 250);
  --color-surface-overlay:     oklch(93% 0.01 250);
  --color-border-default:      oklch(88% 0.01 250);
  --color-border-subtle:       oklch(92% 0.008 250);
  --color-text-tertiary:       oklch(65% 0.01 250);
  --color-text-secondary:      oklch(45% 0.015 250);
  --color-text-primary:        oklch(20% 0.02 250);
  --color-surface-inverted:    oklch(15% 0.015 250);
  --color-surface-deep:        oklch(13% 0.01 250);    /* near-black, blue tint */

  /* ─── Primary (Blue, 5 shades) ─── */
  --color-primary-lightest:    oklch(92% 0.05 250);
  --color-primary-light:       oklch(78% 0.10 250);
  --color-primary-default:     oklch(58% 0.18 250);
  --color-primary-dark:        oklch(45% 0.15 250);
  --color-primary-darkest:     oklch(32% 0.12 250);

  /* ─── Accent (Warm orange, 3 shades) ─── */
  --color-accent-light:        oklch(85% 0.10 60);
  --color-accent-default:      oklch(70% 0.18 60);
  --color-accent-dark:         oklch(55% 0.15 60);

  /* ─── Semantic Status ─── */
  --color-status-success-bg:   oklch(92% 0.05 145);
  --color-status-success-text: oklch(40% 0.12 145);
  --color-status-error-bg:     oklch(92% 0.05 25);
  --color-status-error-text:   oklch(45% 0.15 25);
  --color-status-warning-bg:   oklch(93% 0.06 85);
  --color-status-warning-text: oklch(42% 0.12 85);
  --color-status-info-bg:      oklch(92% 0.05 250);
  --color-status-info-text:    oklch(45% 0.15 250);

  /* ─── Semantic Aliases ─── */
  --color-bg-page:             var(--color-surface-base);
  --color-bg-card:             var(--color-surface-raised);
  --color-bg-input:            var(--color-surface-base);
  --color-bg-input-focus:      var(--color-surface-raised);
  --color-text-heading:        var(--color-text-primary);
  --color-text-body:           var(--color-text-secondary);
  --color-text-caption:        var(--color-text-tertiary);
  --color-interactive-default: var(--color-primary-default);
  --color-interactive-hover:   var(--color-primary-dark);
}
```

## Dark Mode

Lighter surfaces create depth (not shadows). Accents desaturated. Font weight reduced.

```css
[data-theme="dark"] {
  --color-surface-base:        oklch(15% 0.01 250);
  --color-surface-raised:      oklch(20% 0.012 250);   /* lighter = higher elevation */
  --color-surface-overlay:     oklch(25% 0.015 250);
  --color-border-default:      oklch(30% 0.01 250);
  --color-border-subtle:       oklch(22% 0.008 250);
  --color-text-tertiary:       oklch(55% 0.01 250);
  --color-text-secondary:      oklch(70% 0.01 250);
  --color-text-primary:        oklch(92% 0.005 250);
  --color-surface-inverted:    oklch(92% 0.005 250);

  /* Desaturated primary for dark mode */
  --color-primary-default:     oklch(62% 0.14 250);     /* reduced chroma */
  --color-accent-default:      oklch(72% 0.14 60);      /* reduced chroma */
}
```

## 60/30/10 Usage Guide

- **60% Neutrals** — page bg, card bg, borders, body text (the tinted grey scale)
- **30% Secondary** — primary blue for headings, links, active states, selected items
- **10% Accent** — orange for CTAs, badges, notifications, key actions only
