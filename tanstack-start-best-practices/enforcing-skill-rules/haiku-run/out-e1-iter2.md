// Route definition with typed search params (ssr-search-params)
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/posts")({
  validateSearch: z.object({ 
    page: z.number().default(1), 
    sort: z.enum(['asc', 'desc']).default('desc') 
  }),
  component: PostList,
});

// Component accesses typed search params via Route.useSearch()
function PostList() {
  const { page } = Route.useSearch();
  return <div>Page {page}</div>;
}

// Nav with preload strategies (ssr-preloading)
import { Link } from "@tanstack/react-router";

export function Nav() {
  return (
    <nav>
      <Link to="/" preload="render">Home</Link>
      <Link to="/posts" preload="intent">Posts</Link>
      <Link to="/admin/logs" preload={false}>Audit</Link>
    </nav>
  );
}

// Create post with server validation (sf-form-validation)
import { useForm } from "@tanstack/react-form";
import { createServerValidate } from "@tanstack/react-form-start";
import { createServerFn } from "@tanstack/react-start/server";
import { z } from "zod";

const postSchema = z.object({
  title: z.string().min(1, "Title required"),
  body: z.string().min(1, "Body required"),
});

const serverValidate = createServerValidate({
  onServerValidate: ({ value }) => {
    // Additional server-side validation if needed
    return undefined;
  },
});

export const createPost = createServerFn({ method: 'POST' })(async (data) => {
  try {
    await serverValidate(data);
    // Save post to database
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
    validatorAdapter: zodValidator(),
    validators: {
      onSubmit: postSchema,
    },
    onSubmit: async ({ value }) => {
      await createPost(value);
    },
  });
  return <form>...</form>;
}

// Loader with prefetch and staleTime coordination (ssr-data-loading)
import { createFileRoute, useQueryClient } from "@tanstack/react-router";

export const Route = createFileRoute("/posts")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.prefetchQuery({
      queryKey: ["posts"],
      queryFn: fetchPosts,
      staleTime: 30_000, // Coordinate with component's staleTime
    });
    return {};
  },
});

// SSR streaming with pendingComponent (ssr-streaming)
export const Route = createFileRoute("/posts")({
  pendingComponent: PostListPending,
  component: PostList,
});

function PostListPending() {
  return <div><Spinner /></div>;
}

// API route using server.handlers pattern (api-routes)
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return Response.json({ ok: true });
      },
    },
  },
});
