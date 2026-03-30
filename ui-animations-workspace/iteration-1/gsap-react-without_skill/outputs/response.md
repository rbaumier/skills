# Response: GSAP + ScrollTrigger in Next.js App Router

Here's how to set up GSAP with ScrollTrigger in Next.js:

## Installation

```bash
npm install gsap
```

## Setup

```tsx
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function ScrollAnimation() {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const animation = gsap.from(boxRef.current, {
      opacity: 0,
      y: 100,
      duration: 1,
      scrollTrigger: {
        trigger: boxRef.current,
        start: 'top 80%',
        end: 'top 20%',
        scrub: true,
      },
    });

    return () => {
      animation.kill();
    };
  }, []);

  return (
    <div ref={boxRef} className="bg-blue-500 p-8 rounded-lg">
      <h2>Scroll to reveal me!</h2>
    </div>
  );
}
```

This gives you a basic scroll-triggered animation. The element fades in and moves up as you scroll it into view. You can customize the `start` and `end` values to control when the animation triggers.

For more complex setups, you might want to create a GSAP context to handle cleanup:

```tsx
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.from('.box', { opacity: 0, y: 50, stagger: 0.2 });
  });
  return () => ctx.revert();
}, []);
```
