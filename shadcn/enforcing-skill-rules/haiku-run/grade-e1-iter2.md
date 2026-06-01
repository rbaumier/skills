# Grade — shadcn e1 iter2

Grader STRICT. PASS only if the violation is CLEARLY fixed in the real code (not just claimed in prose).

| # | id | Verdict | Evidence (real code) |
|---|-----|---------|----------------------|
| 1 | no-space-xy | PASS | No `space-y-`/`space-x-` anywhere in code body. Spacing uses `flex flex-col gap-6` (L75), `gap-3` (L88, L118), `gap-2` (L89, L138, L156). |
| 2 | size-shorthand | PASS | `<Avatar className="size-12">` (L46). No `w-12 h-12`. |
| 3 | truncate-shorthand | PASS | `<div className="truncate">` (L167). No three-class expansion. |
| 4 | no-dark-manual | PASS | No `dark:` overrides in code. Root uses `bg-background text-foreground` (L39). |
| 5 | semantic-colors | PASS | No `bg-green-*`, `text-green-*`, `bg-blue-*`, `text-gray-*`, `bg-gray-*` in code. Uses `text-muted-foreground` (L45), `bg-background text-foreground` (L39), Alert variants (L147). |
| 6 | cn-conditional | PASS | No template-literal ternary callout div. The verified/unverified callout is now `<Alert variant={user.verified ? "default" : "destructive"}>` (L147) — ternary drives a prop, not a className string. No className ternary present. |
| 7 | no-z-index-overlay | PASS | No `z-50` (or any z-index) in code. `<DialogContent>` plain (L127, L161). |
| 8 | form-field-group | PASS | Name/Bio fields wrapped in `FieldGroup` + `Field` + `FieldLabel` (L60-71); Language in `Field`+`FieldLabel` (L101-102). |
| 9 | inputgroup-textarea | PASS | `<InputGroupTextarea id="bio" .../>` inside `<InputGroup>` (L67-69). No raw Textarea inside InputGroup. |
| 10 | togglegroup-options | PASS | Theme uses `<ToggleGroup type="single">` + 3 `<ToggleGroupItem>` (L78-82). No mapped Buttons. |
| 11 | fieldset-checkboxes | FAIL | Checkboxes grouped with raw `<fieldset>`+`<legend>` (L86-87), not the shadcn `FieldSet` + `FieldLegend` components. Assertion requires `FieldSet + FieldLegend`. Native `<fieldset>`/`<legend>` is still the div+heading-style raw markup the rule forbids; FieldSet/FieldLegend not imported. |
| 12 | select-item-group | FAIL | `SelectItem` rendered directly inside `SelectContent` with no `SelectGroup` (L107-111). `SelectGroup` not imported. Trap not corrected. |
| 13 | dialog-title | PASS | Both Dialogs have `<DialogTitle>` (L128, L162). |
| 14 | card-full-composition | PASS | Card uses `CardHeader`+`CardTitle` for title (L41-43), body `<p>` in `CardContent` (L44-45). No h2 dumped in CardContent. |
| 15 | tabs-trigger-in-list | PASS | `TabsTrigger` inside `<TabsList>` (L54-57). |
| 16 | avatar-fallback | PASS | `<AvatarFallback>{user.name.charAt(0)}</AvatarFallback>` (L48). |
| 17 | button-no-isloading | PASS | No `isLoading`/`isPending` prop. Composed with `Spinner data-icon` + `disabled={saving}` (L119-122). |
| 18 | empty-state-component | PASS | `<Empty>` + `<EmptyDescription>` for no-notifications (L134-135). No custom div. |
| 19 | alert-for-callout | PASS | Verified/unverified callout uses `<Alert variant=...>` + `AlertDescription` (L147-152). No custom styled div. |
| 20 | separator-not-border | PASS | `<Separator />` (L154). No `border-t` div in code. |
| 21 | badge-not-span | PASS | `<Badge variant="outline">{user.role}</Badge>` (L157). No styled span. |
| 22 | skeleton-loading | FAIL | No `Skeleton` usage in the code body despite import (L22) and prose claim (L197). There is no loading-placeholder render path — the original `animate-pulse` skeleton block was removed entirely rather than replaced with a `<Skeleton>` render. Trap not demonstrably corrected in code (Skeleton imported but never used; no loading branch). |
| 23 | icon-data-icon | PASS | Icons in Button carry `data-icon="inline-start"` (Spinner L120, Search L121); Alert icon also `data-icon` (L148). |
| 24 | icon-no-sizing | PASS | No `w-4 h-4` (or sizing) on icons in code. Icons rendered bare with `data-icon`. |
| 25 | icon-as-object | FAIL | No `icon={...}` object prop usage and, more importantly, no iconMap was converted — but the assertion's trap (string-key iconMap lookup) is simply absent with no replacement showing object-passing. Icons are imported and rendered as JSX elements directly (`<Search .../>`), which removes the map but never demonstrates the prescribed `icon={CheckIcon}` object-passing pattern. `Check` imported (L6) but unused. STRICT: trap pattern not shown corrected to the object form; ambiguous → FAIL. |
| 26 | theme-inline-keyword | PASS | `@theme inline {` (L175). |

## Summary

Passed: 21 / 26

Fails:
- **fieldset-checkboxes** — uses raw `<fieldset>`/`<legend>` not `FieldSet`+`FieldLegend`.
- **select-item-group** — `SelectItem` directly in `SelectContent`, no `SelectGroup`.
- **skeleton-loading** — `Skeleton` imported but never rendered; no loading branch; trap not shown corrected.
- **icon-as-object** — object-passing pattern (`icon={Component}`) not demonstrated; only direct JSX render.
