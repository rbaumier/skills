# Dialog Handling

## Browser Dialogs (`alert`, `confirm`, `prompt`)

Use `page.on("dialog")` to handle native browser dialogs. Always set up the handler **before** the action that triggers the dialog.

## Accept/Dismiss Patterns

```typescript
// Accept a confirm dialog
page.on("dialog", (dialog) => dialog.accept());
await page.click('[data-test="delete-button"]');

// Dismiss a confirm dialog
page.on("dialog", (dialog) => dialog.dismiss());
await page.click('[data-test="delete-button"]');
```

## Prompt Dialogs with Input

```typescript
page.on("dialog", (dialog) => dialog.accept("my-token-name"));
await page.click('[data-test="create-button"]');
```

## Sequential Dialog Handling

When a single test triggers multiple dialogs:

```typescript
let dialogCount = 0;
page.on("dialog", async (dialog) => {
  dialogCount++;
  if (dialogCount === 1) await dialog.accept("name");
  else await dialog.accept(); // confirm delete
});
```

## Race Condition Prevention

The dialog handler **must** be registered before the click that triggers it. If registered after, the dialog may auto-dismiss before Playwright sees it.

```typescript
// CORRECT — handler before action
page.on("dialog", (dialog) => dialog.accept());
await page.getByTestId('delete-button').click();

// WRONG — handler after action (race condition)
await page.getByTestId('delete-button').click();
page.on("dialog", (dialog) => dialog.accept()); // too late
```

## One-Time Handler

To handle a single dialog and then remove the listener:

```typescript
page.once("dialog", (dialog) => dialog.accept());
await page.getByTestId('action-button').click();
```
