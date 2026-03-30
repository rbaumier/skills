# User Registration Form — Skill-Informed

## Design Decisions

- **Labels above inputs**, errors below — never floating/placeholder-only labels
- **Correct `type`, `inputmode`, `autocomplete`** on every input
- **Never block paste** — no `onPaste` with `preventDefault`
- **`<button>` for submit** — never `<div onClick>`
- **Verb + noun button label**: "Create Account" not "Submit"
- **Inline errors with focus** — first error gets focus on submit
- **Error messages explain the fix** — never blame the user
- **44px touch targets** — inputs and button meet minimum

```html
<form id="register" novalidate
  style="max-width: 400px; margin: 0 auto; padding: 32px; font-family: 'Geist', sans-serif;">

  <h2 style="font-size: 24px; font-weight: 700; color: oklch(20% 0.02 250); margin-bottom: 32px;">
    Create your account
  </h2>

  <!-- Name -->
  <div style="margin-bottom: 24px;">
    <label for="name"
      style="display: block; font-size: 14px; font-weight: 500; color: oklch(35% 0.02 250); margin-bottom: 6px;">
      Full name
    </label>
    <input type="text" id="name" name="name"
      autocomplete="name"
      required
      style="width: 100%; padding: 12px 14px; min-height: 44px; border: 1px solid oklch(85% 0.01 250);
             border-radius: 8px; font-size: 16px; background: oklch(98.5% 0.005 250);">
    <p class="error" data-for="name"
      style="display: none; color: oklch(50% 0.18 25); font-size: 13px; margin-top: 4px;" role="alert">
    </p>
  </div>

  <!-- Email -->
  <div style="margin-bottom: 24px;">
    <label for="email"
      style="display: block; font-size: 14px; font-weight: 500; color: oklch(35% 0.02 250); margin-bottom: 6px;">
      Email address
    </label>
    <input type="email" id="email" name="email"
      inputmode="email"
      autocomplete="email"
      required
      style="width: 100%; padding: 12px 14px; min-height: 44px; border: 1px solid oklch(85% 0.01 250);
             border-radius: 8px; font-size: 16px; background: oklch(98.5% 0.005 250);">
    <p class="error" data-for="email"
      style="display: none; color: oklch(50% 0.18 25); font-size: 13px; margin-top: 4px;" role="alert">
    </p>
  </div>

  <!-- Password -->
  <div style="margin-bottom: 32px;">
    <label for="password"
      style="display: block; font-size: 14px; font-weight: 500; color: oklch(35% 0.02 250); margin-bottom: 6px;">
      Password
    </label>
    <input type="password" id="password" name="password"
      autocomplete="new-password"
      minlength="8"
      required
      style="width: 100%; padding: 12px 14px; min-height: 44px; border: 1px solid oklch(85% 0.01 250);
             border-radius: 8px; font-size: 16px; background: oklch(98.5% 0.005 250);">
    <p style="font-size: 12px; color: oklch(55% 0.01 250); margin-top: 4px;">
      At least 8 characters
    </p>
    <p class="error" data-for="password"
      style="display: none; color: oklch(50% 0.18 25); font-size: 13px; margin-top: 4px;" role="alert">
    </p>
  </div>

  <!-- Submit — <button>, not <div> -->
  <button type="submit"
    style="width: 100%; padding: 14px 24px; min-height: 44px; background: oklch(50% 0.18 250);
           color: oklch(98% 0.005 250); border: none; border-radius: 8px;
           font-size: 16px; font-weight: 600; cursor: pointer;">
    Create Account
  </button>
</form>

<script>
document.getElementById('register').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;

  // Clear previous errors
  form.querySelectorAll('.error').forEach(el => { el.style.display = 'none'; el.textContent = ''; });

  let firstError = null;
  const name = form.querySelector('#name');
  const email = form.querySelector('#email');
  const password = form.querySelector('#password');

  if (!name.value.trim()) {
    showError('name', 'Please enter your name so we can personalize your experience.');
    firstError = firstError || name;
  }

  if (!email.value.trim()) {
    showError('email', 'We need your email to create your account. You can use any address you check regularly.');
    firstError = firstError || email;
  } else if (!email.value.includes('@')) {
    showError('email', 'This doesn\'t look like a valid email. Check for a missing "@" or domain (e.g., you@company.com).');
    firstError = firstError || email;
  }

  if (!password.value || password.value.length < 8) {
    showError('password', 'Your password needs at least 8 characters. Try combining words you\'ll remember.');
    firstError = firstError || password;
  }

  if (firstError) {
    firstError.focus();
    return;
  }

  // Disable button during submission
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Creating Account...';
});

function showError(field, message) {
  const el = document.querySelector(`.error[data-for="${field}"]`);
  el.textContent = message;
  el.style.display = 'block';
}
</script>
```

## Key Compliance

| Rule | Implementation |
|------|---------------|
| Label above input | Every `<label>` is `display: block` above its input |
| Correct types | `type="email"`, `type="password"`, `inputmode="email"`, `autocomplete="name/email/new-password"` |
| No paste blocking | No `onPaste` handler anywhere |
| `<button>` for actions | `<button type="submit">`, not `<div onClick>` |
| Verb + noun | "Create Account" |
| Inline errors + focus | `.error` elements below each field; `firstError.focus()` on submit |
| Error messages include fix | Each error says what to do next, never blames the user |
| 44px touch targets | `min-height: 44px` on all inputs and button |
