# UX1: How should I handle different types of errors in my UI?

Different errors should be handled differently:

- **Form validation errors**: Show inline next to the field
- **API errors**: Show a toast notification or error message
- **Critical errors**: Show a full-page error state with a retry option

Use Error Boundaries in React to catch rendering errors. For API errors, show user-friendly messages instead of technical details.
