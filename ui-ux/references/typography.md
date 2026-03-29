# Typography

## Classic Typography Principles

### Vertical Rhythm

Your line-height should be the base unit for ALL vertical spacing. If body text has `line-height: 1.5` on `16px` type (= 24px), spacing values should be multiples of 24px. This creates subconscious harmony---text and space share a mathematical foundation.

### Modular Scale & Hierarchy

The common mistake: too many font sizes that are too close together (14px, 15px, 16px, 18px...). This creates muddy hierarchy.

**Use fewer sizes with more contrast.** A 5-size system covers most needs:

| Role | Typical Ratio | Use Case |
|------|---------------|----------|
| xs | 0.75rem | Captions, legal |
| sm | 0.875rem | Secondary UI, metadata |
| base | 1rem | Body text |
| lg | 1.25-1.5rem | Subheadings, lead text |
| xl+ | 2-4rem | Headlines, hero text |

Popular ratios: 1.25 (major third), 1.333 (perfect fourth), 1.5 (perfect fifth). Pick one and commit.

### Readability & Measure

Use `ch` units for character-based measure (`max-width: 65ch`). Line-height scales inversely with line length---narrow columns need tighter leading, wide columns need more.

**Non-obvious**: Increase line-height for light text on dark backgrounds. The perceived weight is lighter, so text needs more breathing room. Add 0.05-0.1 to your normal line-height.

## Font Selection & Pairing

### Choosing Distinctive Fonts

**Avoid the invisible defaults**: Inter, Roboto, Open Sans, Lato, Montserrat. These are everywhere, making your design feel generic. They're fine for documentation or tools where personality isn't the goal---but if you want distinctive design, look elsewhere.

**Better Google Fonts alternatives**:
- Instead of Inter -> **Instrument Sans**, **Plus Jakarta Sans**, **Outfit**
- Instead of Roboto -> **Onest**, **Figtree**, **Urbanist**
- Instead of Open Sans -> **Source Sans 3**, **Nunito Sans**, **DM Sans**
- For editorial/premium feel -> **Fraunces**, **Newsreader**, **Lora**

**System fonts are underrated**: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui` looks native, loads instantly, and is highly readable. Consider this for apps where performance > personality.

### Pairing Principles

**The non-obvious truth**: You often don't need a second font. One well-chosen font family in multiple weights creates cleaner hierarchy than two competing typefaces. Only add a second font when you need genuine contrast (e.g., display headlines + body serif).

When pairing, contrast on multiple axes:
- Serif + Sans (structure contrast)
- Geometric + Humanist (personality contrast)
- Condensed display + Wide body (proportion contrast)

**Never pair fonts that are similar but not identical** (e.g., two geometric sans-serifs). They create visual tension without clear hierarchy.

### Web Font Loading

The layout shift problem: fonts load late, text reflows, and users see content jump.

```css
/* 1. Always use font-display: swap --- text must be visible immediately */
@font-face {
  font-family: 'CustomFont';
  src: url('font.woff2') format('woff2');
  font-display: swap; /* Never omit this */
}

/* 2. Match fallback metrics to minimize shift */
@font-face {
  font-family: 'CustomFont-Fallback';
  src: local('Arial');
  size-adjust: 105%;        /* Scale to match x-height */
  ascent-override: 90%;     /* Match ascender height */
  descent-override: 20%;    /* Match descender depth */
  line-gap-override: 10%;   /* Match line spacing */
}

body {
  font-family: 'CustomFont', 'CustomFont-Fallback', sans-serif;
}
```

Tools like [Fontaine](https://github.com/unjs/fontaine) calculate these overrides automatically.

### Font Synthesis

Prevent the browser from faking bold or italic when a weight/style file is missing. Browser-generated faux styles look terrible:

```css
.display-font,
.icon-font {
  font-synthesis: none;
}
```

## Modern Web Typography

### Fluid Type

Use `clamp(min, preferred, max)` for fluid typography. The middle value (e.g., `5vw + 1rem`) controls scaling rate---higher vw = faster scaling. Add a rem offset so it doesn't collapse to 0 on small screens.

**When NOT to use fluid type**: Button text, labels, UI elements (should be consistent), very short text, or when you need precise breakpoint control.

### Text Wrapping

Modern CSS provides smart text wrapping that eliminates orphans and creates balanced layouts:

```css
/* Balance headings --- lines become roughly equal length */
h1, h2, h3 { text-wrap: balance; }

/* Pretty body text --- reduces orphans (single words on last line) */
p { text-wrap: pretty; }

/* Justified text MUST pair with hyphens to prevent rivers of whitespace */
.article-body {
  text-align: justify;
  hyphens: auto;
}
```

### Underline Refinement

Default underlines collide with descenders (g, p, y). Fix with offset and skip-ink:

```css
a {
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-skip-ink: auto;
}
```

### Letter Spacing for Uppercase

Uppercase and small-caps text needs positive letter-spacing to feel open and readable. Without it, letters feel cramped:

```css
.label {
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.05em;
}
```

### Font Smoothing

Set antialiased rendering on retina displays. The default subpixel rendering looks thicker and fuzzier:

```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### OpenType Features

Most developers don't know these exist. Use them for polish:

```css
/* Tabular numbers --- equal-width digits for data alignment */
.data-table,
.price,
.dashboard-metric { font-variant-numeric: tabular-nums; }

/* Oldstyle numbers --- blend with lowercase in body text */
.body-text { font-variant-numeric: oldstyle-nums; }

/* Lining + tabular for data contexts */
.data-table { font-variant-numeric: lining-nums tabular-nums; }

/* Proper typographic fractions (1/2 -> real fraction glyph) */
.recipe-amount { font-variant-numeric: diagonal-fractions; }

/* Slashed zero --- disambiguate 0 from O in code-adjacent UIs */
.code { font-variant-numeric: slashed-zero; }

/* Small caps for abbreviations */
abbr { font-variant-caps: all-small-caps; }

/* Disable ligatures in code */
code { font-variant-ligatures: none; }

/* Enable kerning (usually on by default, but be explicit) */
body { font-kerning: normal; }

/* Contextual alternates --- adjust punctuation/glyph shapes based on context */
body { font-feature-settings: "calt" 1; }

/* Disambiguation stylistic set --- distinguish I/l/1 and 0/O in code UIs */
.code-ui { font-feature-settings: "ss02"; }
```

Check what features your font supports at [Wakamai Fondue](https://wakamaifondue.com/).

### Variable Fonts

Variable fonts accept any integer weight from 100-900, not just standard stops (400, 500, 600, 700). Use precise values for subtle hierarchy:

```css
.medium    { font-weight: 450; }
.semibold  { font-weight: 550; }
```

Keep optical sizing auto---the font adjusts stroke thickness for the current size (thicker strokes at small sizes, finer details at large sizes):

```css
body {
  font-optical-sizing: auto;
}
```

## Typography System Architecture

Name tokens semantically (`--text-body`, `--text-heading`), not by value (`--font-size-16`). Include font stacks, size scale, weights, line-heights, and letter-spacing in your token system.

## Accessibility Considerations

Beyond contrast ratios (which are well-documented), consider:

- **Never disable zoom**: `user-scalable=no` breaks accessibility. If your layout breaks at 200% zoom, fix the layout.
- **Use rem/em for font sizes**: This respects user browser settings. Never `px` for body text.
- **Minimum 16px body text**: Smaller than this strains eyes and fails WCAG on mobile.
- **Adequate touch targets**: Text links need padding or line-height that creates 44px+ tap targets.

---

**Avoid**: More than 2-3 font families per project. Skipping fallback font definitions. Ignoring font loading performance (FOUT/FOIT). Using decorative fonts for body text. Omitting `font-display: swap`. Allowing browser font synthesis.
