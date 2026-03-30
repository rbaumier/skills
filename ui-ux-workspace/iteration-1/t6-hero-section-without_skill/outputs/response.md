# Developer Tools Hero Section

```html
<section style="background: #0a0a0a; min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; font-family: Inter, sans-serif; padding: 40px;">
  <div style="max-width: 800px;">
    <h1 style="font-size: 64px; font-weight: 600; color: white; line-height: 1.1; margin-bottom: 24px;">
      The Next-Gen Developer Platform
    </h1>
    <p style="font-size: 20px; color: #888; margin-bottom: 40px; line-height: 1.6;">
      Unleash your development potential with our seamless, cutting-edge tools
      that elevate your coding experience to new heights.
    </p>
    <div style="display: flex; gap: 16px; justify-content: center;">
      <button style="background: linear-gradient(to right, #06b6d4, #8b5cf6); color: white; padding: 16px 32px; border: none; border-radius: 8px; font-size: 18px; cursor: pointer; animation: bounce 1s infinite;">
        Get Started
      </button>
      <button style="background: transparent; color: white; padding: 16px 32px; border: 1px solid #333; border-radius: 8px; font-size: 18px; cursor: pointer;">
        Learn More
      </button>
    </div>

    <!-- Visual Element -->
    <div style="margin-top: 60px; background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 40px;">
      <pre style="color: #06b6d4; text-align: left; font-size: 14px;">
$ npm install devtools-cli
✓ Dependencies installed
✓ Configuration generated
$ devtools start
🚀 Server running at localhost:3000
      </pre>
    </div>
  </div>
</section>

<style>
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
</style>
```

This creates an impactful hero with a dark background, gradient CTA, and a code preview element with a glassmorphic card effect.
