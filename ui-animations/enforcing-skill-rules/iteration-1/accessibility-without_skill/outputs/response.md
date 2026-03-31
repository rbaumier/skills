# Response: Scroll-Triggered Parallax Hero with Staggered Text

Here's a parallax hero section with staggered text reveal using GSAP:

```tsx
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function ParallaxHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax background
      gsap.to('.hero-bg', {
        yPercent: 50,
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      // Staggered text reveal
      const chars = titleRef.current?.querySelectorAll('.char');
      gsap.from(chars, {
        opacity: 0,
        y: 100,
        rotateX: -90,
        stagger: 0.03,
        duration: 1,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: titleRef.current,
          start: 'top 80%',
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="relative h-screen overflow-hidden">
      <div className="hero-bg absolute inset-0 bg-cover bg-center"
           style={{ backgroundImage: 'url(/hero.jpg)' }} />
      <h1 ref={titleRef} className="absolute inset-0 flex items-center justify-center text-7xl font-bold text-white">
        {'Welcome'.split('').map((char, i) => (
          <span key={i} className="char inline-block">{char}</span>
        ))}
      </h1>
    </div>
  );
}
```

This creates a smooth parallax effect where the background moves at a different speed than the foreground content, and the text characters animate in one by one as you scroll down.
