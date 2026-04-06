# Run 1 — With Skill (v2 eval)

```tsx
// app/layout.tsx
// FIX: Removed cookies() from layout — it makes ALL child routes dynamic (blast radius).
// Session/theme detection should happen in middleware or per-page.
// FIX: Defer third-party script with strategy="lazyOnload".
// FIX: Inline script in <head> to prevent hydration flicker for theme.
import Script from 'next/script';
import { ThemeProvider } from './theme-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        {/* Inline script prevents theme flicker before hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = document.cookie.includes('session=dark') ? 'dark' : 'light';
                document.documentElement.dataset.theme = theme;
              } catch (e) {}
            `,
          }}
        />
        {/* FIX: strategy="lazyOnload" defers third-party script */}
        <Script src="https://analytics.thirdparty.io/v3/track.js" strategy="lazyOnload" />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

// app/projects/page.tsx
// FIX: Import directly from modules, not barrel files.
// FIX: Wrap data fetchers in React.cache() for per-request deduplication.
// FIX: Use "better-all" pattern — start independent fetches early, await late.
// FIX: Use Suspense boundaries for progressive streaming.
// FIX: Use after() for non-blocking post-response analytics.
// FIX: Minimize data serialized to client — split into smaller client components.
import React, { Suspense } from 'react';
import { after } from 'next/server';
import { getUser } from '@/lib/data/getUser';
import { getProjects } from '@/lib/data/getProjects';
import { getNotifications } from '@/lib/data/getNotifications';
import { ProjectList } from './project-list';
import { NotificationsSidebar } from './notifications-sidebar';
import { ProjectHeader } from './project-header';

// FIX: React.cache() for per-request deduplication
const getCachedUser = React.cache(getUser);
const getCachedProjects = React.cache(getProjects);
const getCachedNotifications = React.cache(getNotifications);

export default async function ProjectsPage() {
  // FIX: "better-all" pattern — start user fetch, start notifications in parallel,
  // then await user for dependent fetch, group remainder with Promise.all.
  const pUser = getCachedUser();
  const pNotifications = getCachedNotifications(); // independent of user.teamId
  const user = await pUser;

  // FIX: after() for non-blocking post-response analytics
  after(async () => {
    await db.analytics.insert({ userId: user.id, page: 'projects', ts: Date.now() });
  });

  const pProjects = getCachedProjects(user.teamId);
  const [projects, notifications] = await Promise.all([pProjects, pNotifications]);

  return (
    <div>
      {/* FIX: Minimize RSC serialization — each component gets only what it needs */}
      <ProjectHeader userName={user.name} userRole={user.role} />
      {/* FIX: Suspense boundary for progressive streaming */}
      <Suspense fallback={<div>Loading projects...</div>}>
        <ProjectList projects={projects} userId={user.id} />
      </Suspense>
      <Suspense fallback={<div>Loading notifications...</div>}>
        <NotificationsSidebar notifications={notifications} />
      </Suspense>
    </div>
  );
}

// app/projects/project-dashboard.tsx
'use client';
import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
// FIX: Import directly from specific modules, not barrel files
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { Chart } from '@/components/Chart';

interface Project {
  id: string;
  name: string;
  budget: number;
  status: 'active' | 'archived' | 'draft';
  ownerId: string;
  tags: string[];
  createdAt: string;
  categoryId: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId: string;
}

const categories = [
  { id: 'eng', label: 'Engineering' },
  { id: 'design', label: 'Design' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'sales', label: 'Sales' },
  { id: 'ops', label: 'Operations' },
];

// FIX: Build Map for O(1) lookups instead of .find() inside .map()
const categoryMap = new Map(categories.map(c => [c.id, c.label]));

// FIX: Hoist RegExp outside component — module-level constant
const URL_PATTERN = /https?:\/\/[^\s/$.?#].[^\s]*/gi;

// FIX: Hoist static JSX outside component function
const footer = (
  <footer className="border-t mt-8 pt-4 text-sm text-gray-500">
    <p>© 2025 ProjectHub. All rights reserved.</p>
    <nav>
      <a href="/terms">Terms</a>
      <a href="/privacy">Privacy</a>
    </nav>
  </footer>
);

export function ProjectDashboard({ user, projects, notifications }: {
  user: User;
  projects: Project[];
  notifications: Notification[];
}) {
  const [filter, setFilter] = useState('');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // FIX: Derive state during render, not in effects
  const activeBudget = useMemo(
    () => projects.filter(p => p.status === 'active').reduce((sum, p) => sum + p.budget, 0),
    [projects]
  );

  // FIX: Derive sorted list during render, not via effect + setState
  // FIX: Use toSorted() for immutable array transforms
  const sortedProjects = useMemo(
    () => projects.toSorted((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [projects]
  );

  // FIX: Use Map for O(1) category lookup instead of .find() inside .map()
  const enrichedProjects = useMemo(
    () => projects.map(project => ({
      ...project,
      categoryLabel: categoryMap.get(project.categoryId) ?? 'Unknown',
    })),
    [projects]
  );

  // FIX: Use [...new Set()] instead of O(n²) indexOf dedup
  const allTags = useMemo(
    () => [...new Set(projects.flatMap(p => p.tags))],
    [projects]
  );

  // FIX: Combine chained .filter().map().filter().map() into single loop
  const highBudgetActive = useMemo(() => {
    const result: string[] = [];
    for (const p of projects) {
      if (p.status === 'active' && p.budget > 50000) {
        result.push(p.name);
      }
    }
    return result;
  }, [projects]);

  // FIX: Use primitive value (user.id) as effect dep, not object reference
  useEffect(() => {
    trackView(user.id);
  }, [user.id]);

  // FIX: useDeferredValue for expensive re-renders during typing
  const deferredFilter = useDeferredValue(filter);

  // FIX: Removed unnecessary useCallback — setFilter is already stable
  const handleSearch = (query: string) => setFilter(query);

  const filtered = useMemo(
    () => enrichedProjects.filter(p =>
      p.name.toLowerCase().includes(deferredFilter.toLowerCase())
    ),
    [enrichedProjects, deferredFilter]
  );

  // FIX: Subscribe to derived booleans, not full store object
  const canEdit = useProjectStore(s => s.permissions.includes('edit'));
  const canDelete = useProjectStore(s => s.permissions.includes('delete'));

  const budgetFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    []
  );

  const statusLabel = useMemo(() => {
    if (!selectedProject) return 'None';
    const p = projects.find(p => p.id === selectedProject);
    return p?.status?.toUpperCase() ?? 'UNKNOWN';
  }, [selectedProject, projects]);

  // FIX: Removed useMemo — trivial string operation, premature optimization
  const projectNameSlug = filter.trim().toLowerCase().replace(/\s+/g, '-');

  // FIX: useLatest/ref pattern — store callback in ref to avoid WebSocket reconnect
  const onProjectUpdateRef = useRef((update: ProjectUpdate) => {
    console.log(`Project update by ${user.name}:`, update);
    sendAnalytics(user.id, update);
  });
  // Keep ref current without triggering effect re-run
  useEffect(() => {
    onProjectUpdateRef.current = (update: ProjectUpdate) => {
      console.log(`Project update by ${user.name}:`, update);
      sendAnalytics(user.id, update);
    };
  });

  // FIX: WebSocket effect no longer depends on callback — stable connection
  useEffect(() => {
    const ws = new WebSocket('/ws/projects');
    ws.onmessage = (e) => onProjectUpdateRef.current(JSON.parse(e.data));
    return () => ws.close();
  }, []);

  // FIX: Lazy initializer for SSR-unsafe localStorage — useState(() => ...)
  // FIX: Caches localStorage read — read once into state
  const [savedTheme, setSavedTheme] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem('projectTheme') : null) || 'default'
  );

  // FIX: Lazy initializer for SSR-unsafe window.innerWidth
  // FIX: Use ref for high-frequency resize tracking instead of useState
  const windowWidthRef = useRef(typeof window !== 'undefined' ? window.innerWidth : 0);
  useEffect(() => {
    const handler = () => { windowWidthRef.current = window.innerWidth; };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // FIX: toSorted()/toReversed() for immutable array transforms
  const orderedByBudget = useMemo(
    () => projects.toSorted((a, b) => b.budget - a.budget),
    [projects]
  );
  const reversedProjects = useMemo(
    () => projects.toReversed(),
    [projects]
  );

  // FIX: Functional setState for stable callbacks — no stale closure
  const [count, setCount] = useState(0);
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);

  return (
    <div>
      <header>
        <h1>Projects — {statusLabel}</h1>
        <span>Budget: {budgetFormatter.format(activeBudget)}</span>
        <span>Slug: {projectNameSlug}</span>
        <div>
          <button onClick={increment}>+</button>
          <span>{count}</span>
          <button onClick={decrement}>-</button>
        </div>
      </header>

      <input
        value={filter}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Search projects..."
      />

      <section>
        {/* FIX: content-visibility: auto for long off-screen lists */}
        {filtered.map((project) => (
          <div
            key={project.id} // FIX: Use project.id, not index — index keys corrupt state on filter/reorder
            onClick={() => setSelectedProject(project.id)}
            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 200px' }}
          >
            <h3>{project.name}</h3>
            <span>{project.categoryLabel}</span>
            <span>{budgetFormatter.format(project.budget)}</span>
            {/* FIX: Ternary instead of && for conditional JSX rendering */}
            {project.status === 'draft' ? <DraftBadge /> : null}
            {canEdit ? <EditButton projectId={project.id} /> : null}
          </div>
        ))}
      </section>

      <aside>
        <h2>Tags</h2>
        {allTags.map(tag => <span key={tag}>{tag}</span>)}
      </aside>

      <ProjectChart data={projects} config={{ animate: true }} />

      {footer}
    </div>
  );
}

function ProjectChart({ data, config }: { data: Project[]; config: ChartConfig }) {
  return <Chart data={data} config={config} />;
}

// app/projects/export-modal.tsx
// FIX: Use next/dynamic for heavy modal — lazy-loaded
// FIX: Preload on hover/focus for ~200ms head start
import dynamic from 'next/dynamic';
import { useTransition } from 'react';

const ExportWizard = dynamic(() => import('./export-wizard'), { ssr: false });
const preloadExportWizard = () => import('./export-wizard');

export function ExportTrigger() {
  const [open, setOpen] = useState(false);
  // FIX: useTransition instead of manual useState loading boolean
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      await runExport();
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        // FIX: Preload chunk on hover/focus
        onMouseEnter={preloadExportWizard}
        onFocus={preloadExportWizard}
      >
        {isPending ? 'Exporting...' : 'Export'}
      </button>
      {open ? <ExportWizard onExport={handleExport} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// app/projects/settings/page.tsx
// FIX: useSearchParams requires Suspense boundary to prevent CSR bailout
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ProjectSettingsContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'general';

  return (
    <div>
      <h1>Settings</h1>
      <TabPanel activeTab={tab} />
    </div>
  );
}

export default function ProjectSettingsPage() {
  return (
    <Suspense fallback={<div>Loading settings...</div>}>
      <ProjectSettingsContent />
    </Suspense>
  );
}

// app/feed/page.tsx
// FIX: Use SWR for client-side request deduplication instead of raw fetch in effects.
// The original fetched /api/posts TWICE — SWR deduplicates automatically.
'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function FeedPage() {
  const { data: posts = [] } = useSWR('/api/posts', fetcher);

  // Derive trending from the single deduplicated fetch
  const trending = useMemo(
    () => posts.filter((p: any) => p.trending),
    [posts]
  );

  return (
    <div>
      <PostList posts={posts} />
      <TrendingSidebar posts={trending} />
    </div>
  );
}

// app/actions/project-actions.ts
// FIX: Server actions are public HTTP endpoints — validate with Zod, check auth.
'use server';
import { z } from 'zod';
import { auth } from '@/lib/auth';

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  budget: z.number().nonnegative(),
  status: z.enum(['active', 'archived', 'draft']),
});

export async function updateProject(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: 'Unauthorized' };

  const parsed = updateProjectSchema.safeParse({
    name: formData.get('name'),
    budget: Number(formData.get('budget')),
    status: formData.get('status'),
  });
  if (!parsed.success) return { error: 'Invalid input' };

  await db.projects.update(parsed.data);
  return { success: true };
}

const deleteProjectSchema = z.object({
  projectId: z.string().uuid(),
});

export async function deleteProject(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: 'Unauthorized' };

  const parsed = deleteProjectSchema.safeParse({
    projectId: formData.get('projectId'),
  });
  if (!parsed.success) return { error: 'Invalid input' };

  await db.projects.delete(parsed.data.projectId);
  return { success: true };
}

// app/projects/edit-form.tsx
// FIX: useActionState (React 19) replaces manual pending/error/success useState pattern
'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateProject } from '@/app/actions/project-actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving...' : 'Save'}
    </button>
  );
}

export function ProjectEditForm({ project }: { project: Project }) {
  const [state, formAction] = useActionState(updateProject, { success: false, error: '' });

  return (
    <form action={formAction}>
      <input name="name" defaultValue={project.name} />
      <input name="budget" type="number" defaultValue={project.budget} />
      <select name="status" defaultValue={project.status}>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
        <option value="draft">Draft</option>
      </select>
      <SubmitButton />
      {state.error ? <p className="text-red-500">{state.error}</p> : null}
      {state.success ? <p className="text-green-500">Saved!</p> : null}
    </form>
  );
}

// app/projects/team-list.tsx
'use client';
import { useState } from 'react';

export function TeamList({ members }: { members: TeamMember[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <ul>
      {/* FIX: Use member.id as key, not array index — index keys cause state bugs on reorder/edit */}
      {members.map((member) => (
        <li key={member.id}>
          {editingId === member.id ? (
            <MemberEditForm member={member} onDone={() => setEditingId(null)} />
          ) : (
            <MemberCard member={member} onEdit={() => setEditingId(member.id)} />
          )}
        </li>
      ))}
    </ul>
  );
}
```
