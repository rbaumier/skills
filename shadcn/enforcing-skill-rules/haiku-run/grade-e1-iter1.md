# Grade — shadcn e1 iter1 (STRICT)

Code: `out-e1-iter1.md` | Assertions: `assertions-e1.json`

| # | id | verdict | evidence |
|---|----|---------|----------|
| 1 | no-space-xy | PASS | No `space-y-`/`space-x-` anywhere; layout uses `flex flex-col gap-6/4/3/2` (L44, L49, L64, L82). |
| 2 | size-shorthand | PASS | L51 `<Avatar className="size-12">` — not `w-12 h-12`. |
| 3 | truncate-shorthand | PASS | L184 `<div className="truncate">`; no `overflow-hidden text-ellipsis whitespace-nowrap`. |
| 4 | no-dark-manual | PASS | No `dark:` overrides; L44 uses `bg-background text-foreground`. |
| 5 | semantic-colors | FAIL | L160 still `"border-green-200 bg-green-50 text-green-900"` — raw color values, not semantic tokens. |
| 6 | cn-conditional | PASS | L159 `className={cn(user.verified && "...")}` — `cn()`, no template-literal ternary. |
| 7 | no-z-index-overlay | PASS | No `z-50`; DialogContent (L145, L178) carries no z-index. |
| 8 | form-field-group | FAIL | L64-70, L71-78, L112-128 still raw `<div className="flex flex-col gap-2"><label/><Input/></div>`; no FieldGroup/Field imported or used. |
| 9 | inputgroup-textarea | PASS | L75-77 `<InputGroup><InputGroupTextarea .../></InputGroup>`; no raw Textarea inside. |
| 10 | togglegroup-options | FAIL | L85-95 still maps `<Button variant={activeTab === t ? "default" : "outline"}>` over 3 theme options; no ToggleGroup/ToggleGroupItem. |
| 11 | fieldset-checkboxes | FAIL | L97-111 still `<div><h3>Notifications</h3>...Checkbox...</div>`; no FieldSet/FieldLegend. |
| 12 | select-item-group | PASS | L121-125 `<SelectGroup>` wraps the `SelectItem`s inside `SelectContent`. |
| 13 | dialog-title | PASS | Both dialogs have `DialogTitle` (L146, L179) with `sr-only`. |
| 14 | card-full-composition | FAIL | L45-56 added CardHeader/CardTitle, but bio is still a raw `<p>` dumped in CardContent (L50); no CardDescription/CardFooter — the "p directly inside" trap residual remains. |
| 15 | tabs-trigger-in-list | PASS | L59-62 `TabsTrigger` inside `TabsList`. |
| 16 | avatar-fallback | PASS | L53 `<AvatarFallback>{user.name.charAt(0)}</AvatarFallback>`. |
| 17 | button-no-isloading | PASS | No `isLoading`/`isPending`; L134-141 composes `Spinner` + `data-icon` + `disabled`. |
| 18 | empty-state-component | FAIL | L151-155 still custom `<div className="flex flex-col items-center justify-center gap-2 py-10">`; no Empty component. |
| 19 | alert-for-callout | PASS | L157-167 uses `<Alert>` + `<AlertDescription>` (raw-color residue is scored under #5). |
| 20 | separator-not-border | PASS | L169 `<Separator />`; no `border-t` div. |
| 21 | badge-not-span | PASS | L172 `<Badge variant="secondary">{user.role}</Badge>`. |
| 22 | skeleton-loading | PASS | L175 `<Skeleton className="h-4 w-32" />`; no `animate-pulse` div. |
| 23 | icon-data-icon | PASS | Search icon no longer rendered; every rendered icon (Spinner L139, AlertCircle L163) carries `data-icon="inline-start"`. |
| 24 | icon-no-sizing | FAIL | L163 `<AlertCircle className="size-4" ...>` — sizing class on an icon inside the Alert component; rule "no sizing classes on icons inside components" still violated. |
| 25 | icon-as-object | PASS | No `iconMap`/string-key lookup anywhere; trap removed. |
| 26 | theme-inline-keyword | PASS | L192 `@theme inline {`. |

**Total: 20 PASS / 6 FAIL.**
