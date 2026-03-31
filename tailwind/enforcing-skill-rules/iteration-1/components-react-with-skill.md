# Components & React Integration - With Skill

## Prompt
Building a Dialog component with forwardRef, and need form validation inside.

## Response

Several improvements needed:

### 1. Use compound component pattern for complex UI

A Dialog should use the **compound component pattern**, not a monolithic component:

```tsx
const Dialog = ({ children }: { children: React.ReactNode }) => {
  // context provider for open/close state
};

Dialog.Trigger = ({ children }: { children: React.ReactNode }) => { /* ... */ };
Dialog.Content = ({ children, className }: { children: React.ReactNode; className?: string }) => { /* ... */ };
Dialog.Header = ({ children }: { children: React.ReactNode }) => { /* ... */ };
Dialog.Title = ({ children }: { children: React.ReactNode }) => { /* ... */ };
Dialog.Footer = ({ children }: { children: React.ReactNode }) => { /* ... */ };
Dialog.Close = ({ children }: { children: React.ReactNode }) => { /* ... */ };
```

Usage:
```tsx
<Dialog>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Edit Profile</Dialog.Title>
    </Dialog.Header>
    <FormContent />
    <Dialog.Footer>
      <Dialog.Close>Cancel</Dialog.Close>
      <Button type="submit">Save</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog>
```

### 2. Use Radix primitives for accessible unstyled components

Don't build Dialog from scratch. **Use Radix primitives** for proper accessibility (focus trapping, Escape key, aria attributes):

```tsx
import * as DialogPrimitive from '@radix-ui/react-dialog';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;

const DialogContent = ({ className, children, ...props }: DialogPrimitive.DialogContentProps) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <DialogPrimitive.Content
      className={cn(
        "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
        "w-full max-w-lg rounded-lg bg-background p-6 shadow-lg",
        "focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);
```

### 3. React 19: ref is a regular prop - no forwardRef needed

In React 19, `ref` is a regular prop. **Remove `forwardRef`**:

```diff
- const Dialog = forwardRef<HTMLDivElement, DialogProps>((props, ref) => {
-   return <div ref={ref} ...>;
- });
+ const Dialog = ({ ref, ...props }: DialogProps & { ref?: React.Ref<HTMLDivElement> }) => {
+   return <div ref={ref} ...>;
+ };
```

`forwardRef` is unnecessary boilerplate in React 19.

### 4. Validate forms with Zod + React Hook Form

Use **Zod** for schema validation and **React Hook Form** for form state:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

type ProfileForm = z.infer<typeof profileSchema>;

function ProfileDialogForm({ onSubmit }: { onSubmit: (data: ProfileForm) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="text-sm font-medium text-foreground">Name</label>
        <input
          id="name"
          {...register('name')}
          className={cn(
            "w-full rounded-md border border-border bg-background px-3 py-2 text-sm",
            "focus:ring-2 focus:ring-offset-2 focus:ring-primary",
            errors.name && "border-destructive"
          )}
        />
        {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
        <input
          id="email"
          {...register('email')}
          className={cn(
            "w-full rounded-md border border-border bg-background px-3 py-2 text-sm",
            "focus:ring-2 focus:ring-offset-2 focus:ring-primary",
            errors.email && "border-destructive"
          )}
        />
        {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
      </div>
    </form>
  );
}
```

### 5. Never concatenate dynamic classes

If you need dynamic colors or variants, **never use template literal concatenation** like `` text-${color}-500 ``. Use a complete string map instead:

```tsx
const colorMap = {
  red: 'text-red-500',
  blue: 'text-blue-500',
  green: 'text-green-500',
} as const;

// Usage
<span className={colorMap[color]}>Text</span>
```

Dynamic concatenation gets purged in production because Tailwind can't detect partial class names at build time.
