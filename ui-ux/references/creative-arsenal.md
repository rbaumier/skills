# Creative Arsenal

High-end design patterns to combat generic AI output. Pull from this library to ensure visually striking, memorable interfaces.

## The Standard Hero Paradigm

Stop doing centered text over a dark image. Try asymmetric Hero sections: Text cleanly aligned to the left or right. The background should feature a high-quality, relevant image with a subtle stylistic fade (darkening or lightening gracefully into the background color depending on light/dark mode).

## Navigation & Menus

- **Mac OS Dock Magnification**: Nav-bar at the edge; icons scale fluidly on hover
- **Magnetic Button**: Buttons that physically pull toward the cursor
- **Gooey Menu**: Sub-items detach from the main button like a viscous liquid
- **Dynamic Island**: A pill-shaped UI component that morphs to show status/alerts
- **Contextual Radial Menu**: A circular menu expanding exactly at the click coordinates
- **Floating Speed Dial**: A FAB that springs out into a curved line of secondary actions
- **Mega Menu Reveal**: Full-screen dropdowns that stagger-fade complex content

## Layout & Grids

- **Bento Grid**: Asymmetric, tile-based grouping (e.g., Apple Control Center)
- **Masonry Layout**: Staggered grid without fixed row heights (e.g., Pinterest)
- **Chroma Grid**: Grid borders or tiles showing subtle, continuously animating color gradients
- **Split Screen Scroll**: Two screen halves sliding in opposite directions on scroll
- **Curtain Reveal**: A Hero section parting in the middle like a curtain on scroll

## Cards & Containers

- **Parallax Tilt Card**: A 3D-tilting card tracking the mouse coordinates
- **Spotlight Border Card**: Card borders that illuminate dynamically under the cursor
- **Glassmorphism Panel**: True frosted glass with inner refraction borders (use purposefully, not decoratively)
- **Holographic Foil Card**: Iridescent, rainbow light reflections shifting on hover
- **Tinder Swipe Stack**: A physical stack of cards the user can swipe away
- **Morphing Modal**: A button that seamlessly expands into its own full-screen dialog container

## Scroll Animations

- **Sticky Scroll Stack**: Cards that stick to the top and physically stack over each other
- **Horizontal Scroll Hijack**: Vertical scroll translates into a smooth horizontal gallery pan
- **Locomotive Scroll Sequence**: Video/3D sequences where framerate is tied to the scrollbar
- **Zoom Parallax**: A central background image zooming in/out seamlessly as you scroll
- **Scroll Progress Path**: SVG vector lines or routes that draw themselves as the user scrolls
- **Liquid Swipe Transition**: Page transitions that wipe the screen like a viscous liquid

## Galleries & Media

- **Dome Gallery**: A 3D gallery feeling like a panoramic dome
- **Coverflow Carousel**: 3D carousel with the center focused and edges angled back
- **Drag-to-Pan Grid**: A boundless grid you can freely drag in any compass direction
- **Accordion Image Slider**: Narrow vertical/horizontal image strips that expand fully on hover
- **Hover Image Trail**: The mouse leaves a trail of popping/fading images behind it
- **Glitch Effect Image**: Brief RGB-channel shifting digital distortion on hover

## Typography & Text Effects

- **Kinetic Marquee**: Endless text bands that reverse direction or speed up on scroll
- **Text Mask Reveal**: Massive typography acting as a transparent window to a video background
- **Text Scramble Effect**: Matrix-style character decoding on load or hover
- **Circular Text Path**: Text curved along a spinning circular path
- **Gradient Stroke Animation**: Outlined text with a gradient continuously running along the stroke
- **Kinetic Typography Grid**: A grid of letters dodging or rotating away from the cursor

## Micro-Interactions & Effects

- **Particle Explosion Button**: CTAs that shatter into particles upon success
- **Liquid Pull-to-Refresh**: Mobile reload indicators acting like detaching water droplets
- **Skeleton Shimmer**: Shifting light reflections moving across placeholder boxes
- **Directional Hover Aware Button**: Hover fill entering from the exact side the mouse entered
- **Ripple Click Effect**: Visual waves rippling precisely from the click coordinates
- **Animated SVG Line Drawing**: Vectors that draw their own contours in real-time
- **Mesh Gradient Background**: Organic, lava-lamp-like animated color blobs
- **Lens Blur Depth**: Dynamic focus blurring background UI layers to highlight a foreground action

## The Bento Paradigm

### Core Design Philosophy
- **Aesthetic**: High-end, minimal, and functional
- **Palette**: Background in `#f9fafb`. Cards are pure white (`#ffffff`) with `border-slate-200/50`
- **Surfaces**: Use `rounded-[2.5rem]` for major containers. Apply "diffusion shadow" (`shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]`)
- **Typography**: Strict `Geist`, `Satoshi`, or `Cabinet Grotesk` font stack. Subtle `tracking-tight` for headers
- **Labels**: Titles and descriptions placed **outside and below** cards for gallery-style presentation
- **Padding**: Generous `p-8` or `p-10` inside cards

### The 5-Card Archetypes

1. **The Intelligent List**: A vertical stack with infinite auto-sorting loop. Items swap positions using `layoutId`, simulating AI prioritizing tasks
2. **The Command Input**: A search/AI bar with multi-step Typewriter Effect. Cycles through prompts with blinking cursor and "processing" shimmer
3. **The Live Status**: A scheduling interface with "breathing" status indicators. Pop-up notification badge with "Overshoot" spring effect
4. **The Wide Data Stream**: Horizontal "Infinite Carousel" of data cards. Seamless loop using `x: ["0%", "-100%"]`
5. **The Contextual UI (Focus Mode)**: Document view with staggered text highlight, followed by floating action toolbar

### Motion Engine Specs
- **Spring Physics**: No linear easing. Use `type: "spring", stiffness: 100, damping: 20`
- **Layout Transitions**: Utilize `layout` and `layoutId` props for smooth re-ordering and shared element transitions
- **Infinite Loops**: Every card should have an "Active State" that loops infinitely (Pulse, Typewriter, Float, Carousel)
- **Performance**: Wrap dynamic lists in `<AnimatePresence>`. Perpetual motion MUST be memoized (`React.memo`) and isolated in microscopic Client Components

### Liquid Glass Refraction
When glassmorphism is needed, go beyond `backdrop-blur`:
- Add 1px inner border (`border-white/10`)
- Add subtle inner shadow (`shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`)
- This simulates physical edge refraction

---

**Remember**: Never mix scroll-animation libraries with React animation libraries in the same component tree. Default to CSS/React animation for UI interactions. Use scroll libraries exclusively for isolated full-page scrolltelling or canvas backgrounds, wrapped in strict useEffect cleanup blocks.
