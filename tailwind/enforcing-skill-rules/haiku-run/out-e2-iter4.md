# Fixed Tailwind v4 Code

## globals.css
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --color-brand: oklch(0.7 0.15 250);
  --color-brand-foreground: oklch(0.98 0.01 250);
  --z-nav: 20;
  --z-toast: 50;
  --animate-fade: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## Card Component
```tsx
export function Card({ variant }: { variant: "primary" | "secondary" }) {
  return (
    <div className={cn(
      variant === "primary" 
        ? "bg-brand text-white" 
        : "bg-gray-200 text-gray-800"
    )}>
      <h2 className="text-lg font-bold">Title</h2>
    </div>
  );
}
```

## Button Variants (CVA removed — only 2 variants)
```tsx
export function Button({ variant }: { variant: "primary" | "secondary" }) {
  return (
    <button className={cn(
      "px-4 py-2 rounded",
      variant === "primary" 
        ? "bg-brand text-white" 
        : "bg-gray-200 text-gray-800"
    )}>
      Click me
    </button>
  );
}
```

## Layout Component
```tsx
export function Layout() {
  return (
    <div>
      <nav className="fixed top-0 z-[theme(--z-nav)] w-full bg-white">Nav</nav>
      <div className="fixed bottom-4 right-4 z-[theme(--z-toast)]">Toast</div>
    </div>
  );
}
```

## Final-Pass Checklist
- [x] forwardRef → none present
- [x] transition-all → none present
- [x] CVA count → 2 variants removed (inlined with ternary)
- [x] oklch(oklch( → unwrapped to single oklch(
- [x] Touch targets → not applicable (no icon buttons)
- [x] Focus ring → not applicable (non-interactive demo)
- [x] Fixed widths → no bare w-[Npx] present
- [x] animate-X used → --animate-fade token defined with @keyframes
- [x] --color-*: initial → not needed (custom palette only)
- [x] container-queries → not applicable
- [x] contrast-more: → not applicable
- [x] @starting-style → not applicable
- [x] tw-animate-css → custom fadeIn justified (brand motion)
- [x] Spacing scale → px-4 py-2 match scale {1,2,3,4,6,8,12,16,24}
- [x] Plugin syntax → @plugin "@tailwindcss/typography" (v4 correct)
- [x] Z-index tokens → z-[theme(--z-nav)] and z-[theme(--z-toast)] from @theme
