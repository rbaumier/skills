# UX2: What should happen when a user clicks submit while request is in flight?

**Always disable the button AND show a loading indicator during async submission.** Both are required — not one or the other.

```tsx
function SubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <button disabled={isSubmitting}>
      {isSubmitting ? (
        <>
          <Spinner size="sm" />
          Submitting...
        </>
      ) : (
        'Submit'
      )}
    </button>
  );
}
```

- **Disable** prevents double-submission
- **Loading indicator** gives visual feedback that the action is in progress

Without disabling, users will click again. Without a loading indicator, users think nothing happened. You need both.
