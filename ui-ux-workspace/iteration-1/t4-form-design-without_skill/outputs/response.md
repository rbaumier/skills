# User Registration Form

```html
<form id="registerForm" style="max-width: 400px; margin: 0 auto; font-family: Arial, sans-serif;">
  <h2>Create Account</h2>

  <div style="margin-bottom: 16px;">
    <label for="name">Name</label>
    <input type="text" id="name" placeholder="John Doe" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" required>
  </div>

  <div style="margin-bottom: 16px;">
    <label for="email">Email</label>
    <input type="text" id="email" placeholder="john@example.com" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" required>
  </div>

  <div style="margin-bottom: 16px;">
    <label for="password">Password</label>
    <input type="password" id="password" placeholder="Enter password" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" required>
  </div>

  <div style="margin-bottom: 16px;">
    <div onclick="handleSubmit()" style="background: #3b82f6; color: white; padding: 10px 20px; border-radius: 4px; cursor: pointer; text-align: center;">
      Submit
    </div>
  </div>
</form>

<script>
function handleSubmit() {
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if (!name) {
    alert('Please enter your name');
    return;
  }
  if (!email) {
    alert('Email is required');
    return;
  }
  if (!password || password.length < 8) {
    alert('Password must be at least 8 characters');
    return;
  }

  console.log('Form submitted!');
}
</script>
```

This creates a clean registration form with basic validation. The blue submit button and clean layout provide a modern look.
