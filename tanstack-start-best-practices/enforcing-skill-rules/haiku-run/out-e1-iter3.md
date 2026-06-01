# TanStack Start Best Practices - Rule Corrections

## Fixed Code

### 1. Posts Route with Typed Search Parameters (ssr-search-params)

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/posts")({
  validateSearch: z.object({
    page: z.number().default(1),
  }),
  component: PostList,
});

function PostList() {
  const { page } = Route.useSearch();
  return <div>Page {page}</div>;
}
```

**Rule Applied**: `ssr-search-params` — Replace manual URLSearchParams with `validateSearch` using Zod schema. Access via `Route.useSearch()`.

---

### 2. Navigation with Preload Strategies (ssr-preloading)

```tsx
import { Link } from "@tanstack/react-router";

export function Nav() {
  return (
    <nav>
      <Link to="/" preload="render">
        Home
      </Link>
      <Link to="/posts" preload="intent">
        Posts
      </Link>
      <Link to="/admin/logs" preload={false}>
        Audit
      </Link>
    </nav>
  );
}
```

**Rule Applied**: `ssr-preloading` — Add explicit `preload` strategies. `"render"` for above-the-fold Home, `"intent"` (default) for Posts hover/focus, `false` for rare Audit link.

---

### 3. Form Validation with createServerValidate (sf-form-validation)

```tsx
import { useForm } from "@tanstack/react-form";
import { createServerValidate } from "@tanstack/react-form-start";
import { createServerFn } from "@tanstack/start";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(1, "Title required"),
  body: z.string().min(1, "Body required"),
});

const serverValidate = createServerValidate({
  schema: createPostSchema,
  onServerValidate: async ({ value }) => {
    // Additional server-only checks (e.g., uniqueness)
    if (await checkTitleExists(value.title)) {
      throw new Error("Title already exists");
    }
  },
});

const createPostFn = createServerFn({ method: "POST" })(async (ctx) => {
  try {
    await serverValidate(ctx.data);
    // Mutation logic here
    return { success: true };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return e.response;
    }
    throw e;
  }
});

export function CreatePost() {
  const form = useForm({
    defaultValues: { title: "", body: "" },
    onSubmit: ({ value }) => createPostFn(value),
    validators: {
      onChange: createPostSchema,
    },
  });

  return <form>...</form>;
}
```

**Rule Applied**: `sf-form-validation` — Use `createServerValidate` to share one schema between client and server. Avoid hand-rolled `schema.parseAsync()` inside server functions.

---

### 4. Data Prefetching with Coordinated staleTime (ssr-data-loading)

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/posts")({
  validateSearch: z.object({
    page: z.number().default(1),
  }),
  loader: async () => {
    const posts = await queryClient.prefetchQuery({
      queryKey: ["posts"],
      queryFn: fetchPosts,
      staleTime: 30 * 1000, // 30 seconds — matches or exceeds typical navigation time
    });
    return { posts };
  },
  component: PostList,
});
```

**Rule Applied**: `ssr-data-loading` — Set `staleTime >= 30s` to prevent immediate refetch after loader has already prefetched. Without this, the component refetches immediately even though the loader just fetched.

---

### 5. Route-Level Streaming with pendingComponent (ssr-streaming)

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

function PostListPending() {
  return <div>Loading posts...</div>;
}

export const Route = createFileRoute("/posts")({
  validateSearch: z.object({
    page: z.number().default(1),
  }),
  pendingComponent: PostListPending,
  loader: async () => {
    // Prefetch data
    return { posts: await fetchPosts() };
  },
  component: PostList,
});

function PostList() {
  const { page } = Route.useSearch();
  return <div>Page {page}</div>;
}

function PostContent() {
  // Sub-route streaming only — Suspense for content within the page
  return (
    <Suspense fallback={<Spinner />}>
      {/* Async component here */}
    </Suspense>
  );
}
```

**Rule Applied**: `ssr-streaming` — Use `pendingComponent` for route-level loading states (co-located with route, participates in preloading). Suspense is for sub-route streaming only, not at the route level.

---

### 6. API Routes with Proper server.handlers (api-routes)

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({ ok: true });
      },
    },
  },
});
```

**Rule Applied**: `api-routes` — Use `createFileRoute` with `server.handlers` per HTTP method. Do NOT use `loader` for API routes (breaks SSR data flow). The old `createAPIFileRoute` is deprecated.

---

## Summary of Rules Applied

1. **ssr-search-params** — Typed search parameters via `validateSearch` + `Route.useSearch()`
2. **ssr-preloading** — Link preload strategies (`"render"`, `"intent"`, `false`)
3. **sf-form-validation** — `createServerValidate` for shared client/server schema
4. **ssr-data-loading** — `staleTime` coordination (30s) to prevent immediate refetch
5. **ssr-streaming** — `pendingComponent` for route-level loading, Suspense for sub-routes only
6. **api-routes** — `createFileRoute` + `server.handlers` instead of `loader`
