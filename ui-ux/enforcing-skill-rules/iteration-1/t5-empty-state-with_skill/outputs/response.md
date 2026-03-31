# Empty State — First-Use Task List (Skill-Informed)

## Design Decisions

- **5-part empty state**: what will be here, why it matters, how to start, visual interest, contextual help
- **No AI-slop copy** — no "elevate", "seamless", "unleash", "next-gen"
- **No cliche loading messages** — product-specific language only
- **Active voice** — "Create your first task" not "Tasks can be created"
- **Custom illustration placeholder** — not stock emoji or generic icons

```html
<div style="max-width: 480px; margin: 80px auto; padding: 40px; text-align: center; font-family: 'Geist', sans-serif;">

  <!-- Visual interest: custom illustration, not a stock emoji -->
  <div style="width: 180px; height: 140px; margin: 0 auto 32px; background: oklch(95% 0.02 250);
              border-radius: 16px; display: flex; align-items: center; justify-content: center;
              border: 2px dashed oklch(80% 0.03 250);">
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="16" width="40" height="6" rx="3" fill="oklch(75% 0.05 250)"/>
      <rect x="12" y="28" width="32" height="6" rx="3" fill="oklch(82% 0.04 250)"/>
      <rect x="12" y="40" width="24" height="6" rx="3" fill="oklch(88% 0.03 250)"/>
      <circle cx="48" cy="48" r="12" fill="oklch(58% 0.18 250)"/>
      <path d="M44 48h8M48 44v8" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>
  </div>

  <!-- (1) What will be here -->
  <h2 style="font-size: 22px; font-weight: 700; color: oklch(20% 0.02 250); margin-bottom: 8px;">
    Your tasks live here
  </h2>

  <!-- (2) Why it matters -->
  <p style="font-size: 15px; color: oklch(45% 0.015 250); line-height: 1.6; margin-bottom: 8px;">
    Track what needs doing, assign deadlines, and see progress across your whole project in one place.
  </p>

  <!-- (5) Contextual help -->
  <p style="font-size: 13px; color: oklch(60% 0.01 250); margin-bottom: 28px;">
    Tasks can have subtasks, labels, due dates, and assignees. Start simple — add detail later.
  </p>

  <!-- (3) How to get started — clear CTA, active voice -->
  <button style="padding: 14px 28px; min-height: 44px; background: oklch(50% 0.18 250);
                 color: oklch(98% 0.005 250); border: none; border-radius: 8px;
                 font-size: 15px; font-weight: 600; cursor: pointer;">
    Create your first task
  </button>

  <p style="font-size: 13px; color: oklch(60% 0.01 250); margin-top: 16px;">
    Or press <kbd style="padding: 2px 6px; background: oklch(93% 0.01 250); border-radius: 4px;
                        font-size: 12px; border: 1px solid oklch(85% 0.01 250);">N</kbd> anywhere to quick-add
  </p>
</div>
```

## Compliance Checklist

| Empty State Element | Addressed |
|---|---|
| (1) What will be here | "Your tasks live here" |
| (2) Why it matters | "Track what needs doing... see progress across your whole project" |
| (3) How to get started | "Create your first task" button + keyboard shortcut |
| (4) Visual interest | Custom SVG illustration with task-list motif |
| (5) Contextual help | "Tasks can have subtasks, labels, due dates..." |
| No AI-slop copy | Zero instances of "elevate/seamless/unleash/next-gen" |
| Active voice | "Create your first task", "Track what needs doing" |
