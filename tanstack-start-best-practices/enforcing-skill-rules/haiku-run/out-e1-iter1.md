```tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// 1. SEARCH PARAMS: Use validateSearch for typed URL parameters (ssr-search-params)
export const Route = createFileRoute("/posts")({
  validateSearch: z.object({
    page: z.number().default(1),
  }),
  component: PostList,
});

function PostList() {
  // Use Route.useSearch() instead of URLSearchParams
  const { page } = Route.useSearch();
  return <div>Page {page}</div>;
}

import { Link } from "@tanstack/react-router";

// 2. PRELOADING: Add preload strategy to links (ssr-preloading)
export function Nav() {
  return (
    <nav>
      {/* render: immediate, for above-the-fold links */}
      <Link to="/" preload="render">
        Home
      </Link>
      {/* intent: default, on hover/focus */}
      <Link to="/posts" preload="intent">
        Posts
      </Link>
      {/* false: disabled for rare links */}
      <Link to="/admin/logs" preload={false}>
        Audit
      </Link>
    </nav>
  );
}

import { useForm } from "@tanstack/react-form";
import { createServerFn } from "@tanstack/react-start";

// 3. SERVER FUNCTION: Create mutation with validation (sf-create-server-fn + sf-input-validation)
const createPostSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

export const createPost = createServerFn({ method: "POST" })
  .validator(createPostSchema)
  .handler(async ({ data }) => {
    // Save to database
    return { id: "1", ...data };
  });

// 4. FORM VALIDATION: Export server validation for client form (sf-form-validation)
export async function serverValidate(data: any) {
  try {
    return await createPostSchema.parseAsync(data);
  } catch (err) {
    throw err;
  }
}

export function CreatePost() {
  // Use serverValidate from .functions.ts
  const form = useForm({
    defaultValues: { title: "", body: "" },
    onSubmit: ({ value }) => createPost({ data: value }),
  });
  return <form>...</form>;
}

// 5. SSR DATA LOADING: Use ensureQueryData to coordinate staleTime (ssr-data-loading)
import { useSuspenseQuery } from "@tanstack/react-query";

const fetchPosts = async () => {
  return [{ id: "1", title: "Post 1" }];
};

export const Route = createFileRoute("/posts")({
  loader: async ({ context: { queryClient } }) => {
    // Await critical data - blocks SSR
    return await queryClient.ensureQueryData({
      queryKey: ["posts"],
      queryFn: fetchPosts,
      // Set staleTime >= navigation time (~5-30s) for prefetched queries
      staleTime: 30 * 1000,
    });
  },
  // 6. STREAMING: Use pendingComponent for route-level loading state (ssr-streaming)
  pendingComponent: () => <div>Loading posts...</div>,
  component: PostPage,
});

export function PostPage() {
  const posts = Route.useLoaderData();

  return (
    <div>
      {/* Critical data from loader - renders immediately */}
      <h1>Posts</h1>

      {/* Non-critical content wrapped in Suspense for streaming */}
      <Suspense fallback={<Spinner />}>
        <PostContent posts={posts} />
      </Suspense>
    </div>
  );
}

function PostContent({ posts }: any) {
  return (
    <ul>
      {posts.map((post: any) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}

function Spinner() {
  return <div>Loading content...</div>;
}

import { Suspense } from "react";

// 7. API ROUTES: Use createFileRoute with handlers, not loader for /api routes (api-routes)
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
