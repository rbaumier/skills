# UX2: What should happen when a user clicks submit while request is in flight?

Show a loading spinner or change the button text to indicate the form is being submitted. You should also disable the button to prevent double submissions:

```tsx
<button disabled={loading}>
  {loading ? 'Submitting...' : 'Submit'}
</button>
```
