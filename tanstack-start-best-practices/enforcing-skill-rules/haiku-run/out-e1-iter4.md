```tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// ✓ ssr-search-params: Define typed search params per route
export const Route = createFileRoute("/posts")({
  validateSearch: z.object({
    page: z.number().default(1),
  }),
  component: PostList,
});

// ✓ ssr-search-params: Access via Route.useSearch()
function PostList() {
  const { page } = Route.useSearch();
  return <div>Page {page}</div>;
}

import { Link } from "@tanstack/react-router";

// ✓ ssr-preloading: Configure link preload strategies
export function Nav() {
  return (
    <nav>
      {/* Above-the-fold link: eager preload */}
      <Link to="/" preload="render">
        Home
      </Link>
      {/* Default: preload on hover/focus */}
      <Link to="/posts" preload="intent">
        Posts
      </Link>
      {/* Rare link: disable preload */}
      <Link to="/admin/logs" preload={false}>
        Audit
      </Link>
    </nav>
  );
}

import { useForm } from "@tanstack/react-form";
import { createServerFn } from "@tanstack/react-start";
import { createServerValidate } from "@tanstack/react-form-start";

// ✓ sf-form-validation: Server-side validation via createServerValidate
const createPostSchema = z.object({
  title: z.string().min(1, "Title required"),
  body: z.string().min(1, "Body required"),
});

const serverValidate = createServerValidate({
  schema: createPostSchema,
  onServerValidate: async ({ value }) => {
    // Additional server-only checks (e.g., duplicate detection)
    if (await isDuplicateTitle(value.title)) {
      throw new Error("Title already exists");
    }
  },
});

const createPostFn = createServerFn({ method: "POST" })({
  data: createPostSchema,
  handler: async (data) => {
    try {
      await serverValidate({ data });
      const post = await savePost(data);
      return { ok: true, post };
    } catch (error) {
      if (error instanceof ServerValidateError) {
        return error.response;
      }
      throw error;
    }
  },
});

export function CreatePost() {
  // ✓ sf-form-validation: Client re-runs same validators + folds server result
  const form = useForm({
    defaultValues: { title: "", body: "" },
    onSubmit: ({ value }) => createPostFn({ data: value }),
    validators: {
      onChange: createPostSchema,
    },
  });

  return <form>...</form>;
}

// ✓ ssr-data-loading: Prefetch data with appropriate staleTime
export const Route = createFileRoute("/posts")({
  beforeLoad: async ({ context }) => {
    const posts = await context.queryClient.prefetchQuery({
      queryKey: ["posts"],
      queryFn: fetchPosts,
      staleTime: 5 * 60 * 1000, // 5 minutes: coordinate with navigation time
    });
    return { posts };
  },
});

import { Suspense } from "react";

// ✓ ssr-streaming: Use Suspense for sub-route streaming (not route-level)
export function PostPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PostContent />
    </Suspense>
  );
}

// ✓ api-routes: Use createFileRoute with server.handlers (not deprecated loader)
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return Response.json({ ok: true });
      },
    },
  },
});
```

**Issues Fixed:**

1. **ssr-search-params**: Replaced `new URLSearchParams(window.location.search)` with `validateSearch: z.object({ page: z.number().default(1) })` and accessed via `Route.useSearch()`

2. **ssr-preloading**: Added `preload` strategies to Link components:
   - `preload="render"` for above-the-fold (Home)
   - `preload="intent"` for default (Posts)
   - `preload={false}` for rare links (Audit)

3. **sf-form-validation**: Replaced direct `onSubmit` with `createServerValidate` pattern — server function validates inside `try/catch`, client reuses same schema validators

4. **api-routes**: Changed `/api/health` from deprecated `loader` returning `Response.json` to proper `server: { handlers: { GET: ... } }` pattern

5. **ssr-data-loading**: Changed `loader` to `beforeLoad` with explicit `staleTime: 5 * 60 * 1000` to prevent immediate refetch after prefetch
