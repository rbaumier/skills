# Dashboard Metric Cards

Here's a dashboard with three metric cards:

```html
<div style="background: #000; min-height: 100vh; padding: 40px; font-family: Inter, sans-serif;">
  <h1 style="color: white; text-align: center; font-size: 48px;">Dashboard</h1>

  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1200px; margin: 0 auto;">

    <!-- Revenue Card -->
    <div style="background: #111; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
      <div style="height: 4px; background: linear-gradient(to right, #06b6d4, #8b5cf6); border-radius: 4px; margin-bottom: 16px;"></div>
      <p style="color: #888; font-size: 14px;">Revenue</p>
      <p style="color: white; font-size: 48px; font-weight: bold; background: linear-gradient(to right, #06b6d4, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">$124,500</p>
    </div>

    <!-- Users Card -->
    <div style="background: #111; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
      <div style="height: 4px; background: linear-gradient(to right, #06b6d4, #8b5cf6); border-radius: 4px; margin-bottom: 16px;"></div>
      <p style="color: #888; font-size: 14px;">Users</p>
      <p style="color: white; font-size: 48px; font-weight: bold; background: linear-gradient(to right, #06b6d4, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">8,392</p>
    </div>

    <!-- Orders Card -->
    <div style="background: #111; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
      <div style="height: 4px; background: linear-gradient(to right, #06b6d4, #8b5cf6); border-radius: 4px; margin-bottom: 16px;"></div>
      <p style="color: #888; font-size: 14px;">Orders</p>
      <p style="color: white; font-size: 48px; font-weight: bold; background: linear-gradient(to right, #06b6d4, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">1,247</p>
    </div>

  </div>
</div>
```

This gives you a clean, modern dark dashboard with:
- Three equal-width metric cards in a grid
- Gradient accent bars at the top of each card
- Large gradient numbers for visual impact
- Cyan-to-purple color scheme for a tech feel
- Inter font for clean readability
