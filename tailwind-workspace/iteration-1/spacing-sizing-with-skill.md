# Spacing & Sizing - With Skill

## Prompt
Review component spacing (p-5, mb-7, w-12 h-12, text-[16px], w-8 h-8).

## Response

Several issues to fix:

### 1. Spacing scale violations: avoid p-5 and mb-7

**Use spacing scale increments of 4** (4, 6, 8, 12, 16, 24). Avoid odd values like `p-5` (20px) and `mb-7` (28px) which break visual rhythm.

```diff
- <div className="p-5 mb-7 w-12 h-12">
+ <div className="p-4 mb-8 size-12">
```

- `p-5` (20px) -> `p-4` (16px) or `p-6` (24px)
- `mb-7` (28px) -> `mb-6` (24px) or `mb-8` (32px)

### 2. Use Tailwind size classes, not arbitrary px values

**Never use arbitrary px values** like `text-[16px]` when a Tailwind class exists. Use `text-base` instead:

```diff
- <p className="text-[16px] leading-[24px]">Hello</p>
+ <p className="text-base leading-6">Hello</p>
```

`text-base` = 16px/1rem, `leading-6` = 24px. Arbitrary values bypass the design system and make it harder to maintain consistency.

### 3. Use `size-*` shorthand for equal dimensions

When both width and height are the same, **use `size-*` shorthand**:

```diff
- <div className="w-12 h-12">
+ <div className="size-12">

- <div className="w-8 h-8 bg-blue-500 rounded">
+ <div className="size-8 bg-blue-500 rounded">
```

`size-12` = `w-12 h-12` (48px x 48px), `size-8` = `w-8 h-8` (32px x 32px). Cleaner and more concise.

### Fixed version

```tsx
<div className="p-4 mb-8 size-12">
  <p className="text-base leading-6">Hello</p>
  <div className="size-8 bg-blue-500 rounded"></div>
</div>
```
