# Components & React Integration - Without Skill

## Prompt
Building a Dialog component with forwardRef, and need form validation inside.

## Response

### 1. Dialog component structure

Your Dialog implementation is a reasonable start. A few improvements:

```tsx
const Dialog = forwardRef<HTMLDivElement, DialogProps>(({ title, children, onClose }, ref) => {
  return (
    <div ref={ref} className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <div>{children}</div>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
        >
          Close
        </button>
      </div>
    </div>
  );
});
```

Consider using a portal (`createPortal`) to render the dialog at the document root level.

### 2. Form validation

For form validation inside the Dialog, you could use:

- **React Hook Form** for form state management
- **Yup** or **Zod** for schema validation

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

function DialogForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
    </form>
  );
}
```

### 3. Accessibility

Add proper ARIA attributes:
- `role="dialog"` and `aria-modal="true"` on the dialog container
- Trap focus within the dialog
- Close on Escape key
