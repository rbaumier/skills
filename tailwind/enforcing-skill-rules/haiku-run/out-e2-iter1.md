```css
/* globals.css */
@import "tailwindcss";

@theme {
  --color-brand: oklch(0.7 0.15 250);
  --color-brand-foreground: oklch(0.98 0.01 250);
  --animate-fade: fadeIn 0.3s ease-out;
  --z-nav: 20;
  --z-toast: 50;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@plugin "@tailwindcss/typography";
```

```tsx
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

const cardVariants = cva("p-4 rounded", {
  variants: {
    variant: {
      primary: "bg-brand text-brand-foreground",
      secondary: "bg-gray-100 text-gray-900",
    },
  },
});

export function Card({ variant }: { variant: "primary" | "secondary" }) {
  return (
    <div className={cardVariants({ variant })}>
      <h2 className="text-lg font-bold">Title</h2>
    </div>
  );
}

const buttonVariants = cva("px-4 py-2 rounded", {
  variants: {
    variant: {
      primary: "bg-brand text-brand-foreground",
      secondary: "bg-gray-200 text-gray-800",
    },
  },
});

export function Button({ variant }: { variant: "primary" | "secondary" }) {
  return <button className={buttonVariants({ variant })}>Button</button>;
}

export function Layout() {
  return (
    <div>
      <nav className="fixed top-0 z-[theme(--z-nav)] w-full bg-white">Nav</nav>
      <div className="fixed bottom-4 right-4 z-[theme(--z-toast)]">Toast</div>
    </div>
  );
}
```
