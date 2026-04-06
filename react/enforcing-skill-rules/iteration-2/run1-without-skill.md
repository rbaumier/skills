# Run 1 — Without Skill (v2 eval)

```tsx
// app/layout.tsx
// NOTE: cookies() removed from layout to avoid making ALL child routes dynamic.
// Session/theme detection should happen in middleware or per-page.
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {/* strategy="lazyOnload" defers third-party script to avoid blocking render */}
        <Script src="https://analytics.thirdparty.io/v3/track.js" strategy="lazyOnload" />
        {children}
      </body>
    </html>
  );
}

// app/middleware.ts (new — theme detection moved here)
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  const theme = session?.value === 'dark' ? 'dark' : 'light';
  const response = NextResponse.next();
  response.headers.set('x-theme', theme);
  return response;
}

// app/theme-layout-wrapper.tsx (Server Component that reads theme from header)
import { headers } from 'next/headers';
import { ThemeProvider } from './theme-provider';

export async function ThemeLayoutWrapper({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const theme = (headerList.get('x-theme') as 'dark' | 'light') ?? 'light';
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

// app/projects/page.tsx
import { Suspense } from 'react';
import { cache } from 'react';
import { after } from 'next/server';
import { getUser as _getUser } from '@/lib/data/getUser';
import { getProjects as _getProjects } from '@/lib/data/getProjects';
import { getNotifications as _getNotifications } from '@/lib/data/getNotifications';
import { ProjectDashboard } from './project-dashboard';
import { NotificationsPanel } from './notifications-panel';

// Wrap in React.cache() for per-request deduplication
const getUser = cache(_getUser);
const getProjects = cache(_getProjects);
const getNotifications = cache(_getNotifications);

export default async function ProjectsPage() {
  const user = await getUser();

  // Start independent fetches in parallel (better-all pattern)
  const [projects, notifications] = await Promise.all([
    getProjects(user.teamId),
    getNotifications(user.id),
  ]);

  // Non-blocking post-response analytics via after()
  after(async () => {
    await db.analytics.insert({ userId: user.id, page: 'projects', ts: Date.now() });
  });

  return (
    <div>
      {/* Stream project dashboard immediately */}
      <Suspense fallback={<ProjectDashboardSkeleton />}>
        <ProjectDashboard user={user} projects={projects} />
      </Suspense>

      {/* Stream notifications independently */}
      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsPanel notifications={notifications} />
      </Suspense>
    </div>
  );
}

// app/projects/project-dashboard.tsx
'use client';
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useDeferredValue,
} from 'react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils/cn';
import { Chart } from '@/components/Chart';

// --- Types ---
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

// --- Hoisted constants (avoid re-creation every render) ---
const categories = [
  { id: 'eng', label: 'Engineering' },
  { id: 'design', label: 'Design' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'sales', label: 'Sales' },
  { id: 'ops', label: 'Operations' },
] as const;

// O(1) lookup map instead of .find() inside .map()
const categoryMap = new Map(categories.map(c => [c.id, c.label]));

// Hoisted regex outside component — not recreated every render
const URL_PATTERN = /https?:\/\/[^\s/$.?#].[^\s]*/gi;

// Hoisted static JSX — not recreated every render
const footer = (
  <footer className="border-t mt-8 pt-4 text-sm text-gray-500">
    <p>&copy; 2025 ProjectHub. All rights reserved.</p>
    <nav>
      <a href="/terms">Terms</a>
      <a href="/privacy">Privacy</a>
    </nav>
  </footer>
);

// Budget formatter — module-level singleton, never changes
const budgetFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function ProjectDashboard({
  user,
  projects,
}: {
  user: User;
  projects: Project[];
}) {
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Derived state — computed during render, no useEffect needed
  const activeBudget = useMemo(
    () =>
      projects
        .filter(p => p.status === 'active')
        .reduce((sum, p) => sum + p.budget, 0),
    [projects],
  );

  // Derived sorted list — useMemo, not useEffect + setState
  const sortedProjects = useMemo(
    () =>
      projects.toSorted(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [projects],
  );

  // Enrich with category labels using O(1) Map lookup
  const enrichedProjects = useMemo(
    () =>
      projects.map(project => ({
        ...project,
        categoryLabel: categoryMap.get(project.categoryId) ?? 'Unknown',
      })),
    [projects],
  );

  // Deduplicate tags with Set instead of indexOf
  const allTags = useMemo(
    () => [...new Set(projects.flatMap(p => p.tags))],
    [projects],
  );

  // Single-loop instead of chained .filter().map().filter().map()
  const highBudgetActive = useMemo(() => {
    const result: string[] = [];
    for (const p of projects) {
      if (p.status === 'active' && p.budget > 50000) {
        result.push(p.name);
      }
    }
    return result;
  }, [projects]);

  // Primitive dependency (user.id) instead of object reference
  const onProjectUpdateRef = useRef<(update: any) => void>(() => {});
  onProjectUpdateRef.current = (update: any) => {
    console.log(`Project update by ${user.name}:`, update);
    sendAnalytics(user.id, update);
  };

  useEffect(() => {
    trackView(user.id);
  }, [user.id]);

  // useLatest pattern — store callback in ref to avoid WebSocket reconnect
  useEffect(() => {
    const ws = new WebSocket('/ws/projects');
    ws.onmessage = (e) => onProjectUpdateRef.current(JSON.parse(e.data));
    return () => ws.close();
  }, []); // stable — no reconnect on user change

  // SSR-safe localStorage read via lazy initializer
  const [savedTheme, setSavedTheme] = useState(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem('projectTheme') || 'default'
      : 'default',
  );

  // SSR-safe window.innerWidth via lazy initializer
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 0,
  );
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Subscribe only to what we need from store, not entire state
  const canEdit = useProjectStore(s => s.permissions.includes('edit'));
  const canDelete = useProjectStore(s => s.permissions.includes('delete'));

  const statusLabel = useMemo(() => {
    if (!selectedProject) return 'None';
    const p = projects.find(p => p.id === selectedProject);
    return p?.status?.toUpperCase() ?? 'UNKNOWN';
  }, [selectedProject, projects]);

  // Simple string transform — no useMemo needed (trivial computation)
  const projectNameSlug = filter.trim().toLowerCase().replace(/\s+/g, '-');

  // Filtered list uses deferred value for responsive input
  const filtered = useMemo(
    () =>
      enrichedProjects.filter(p =>
        p.name.toLowerCase().includes(deferredFilter.toLowerCase()),
      ),
    [enrichedProjects, deferredFilter],
  );

  // toSorted / toReversed instead of spread + mutate
  const orderedByBudget = useMemo(
    () => projects.toSorted((a, b) => b.budget - a.budget),
    [projects],
  );
  const reversedProjects = useMemo(
    () => projects.toReversed(),
    [projects],
  );

  // Functional setState — stable callbacks, no stale closure
  const [count, setCount] = useState(0);
  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);

  return (
    <div>
      <header>
        <h1>Projects &mdash; {statusLabel}</h1>
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
        onChange={e => setFilter(e.target.value)}
        placeholder="Search projects..."
      />

      {/* content-visibility: auto for free browser virtualization on long lists */}
      <section style={{ contentVisibility: 'auto' }}>
        {filtered.map(project => (
          <div key={project.id} onClick={() => setSelectedProject(project.id)}>
            <h3>{project.name}</h3>
            <span>{project.categoryLabel}</span>
            <span>{budgetFormatter.format(project.budget)}</span>
            {/* Ternary instead of && to avoid rendering falsy values */}
            {project.status === 'draft' ? <DraftBadge /> : null}
            {canEdit ? <EditButton projectId={project.id} /> : null}
          </div>
        ))}
      </section>

      <aside>
        <h2>Tags</h2>
        {allTags.map(tag => (
          <span key={tag}>{tag}</span>
        ))}
      </aside>

      <ProjectChart data={projects} config={{ animate: true }} />

      {footer}
    </div>
  );
}

function ProjectChart({
  data,
  config,
}: {
  data: Project[];
  config: ChartConfig;
}) {
  return <Chart data={data} config={config} />;
}

// app/projects/export-modal.tsx
'use client';
import { useTransition, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Lazy-load heavy modal — not needed until user clicks
const ExportWizard = dynamic(() => import('./export-wizard'), {
  loading: () => <p>Loading...</p>,
});

// Preload function for hover/focus
const preloadExportWizard = () => import('./export-wizard');

export function ExportTrigger() {
  const [open, setOpen] = useState(false);
  // useTransition instead of manual loading boolean
  const [isPending, startTransition] = useTransition();

  const handleExport = useCallback(async () => {
    startTransition(async () => {
      await runExport();
    });
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        onMouseEnter={preloadExportWizard}
        onFocus={preloadExportWizard}
      >
        {isPending ? 'Exporting...' : 'Export'}
      </button>
      {open ? (
        <ExportWizard onExport={handleExport} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

// app/projects/settings/page.tsx
import { Suspense } from 'react';
import { SettingsContent } from './settings-content';

// Suspense boundary prevents useSearchParams from forcing entire page to CSR
export default function ProjectSettingsPage() {
  return (
    <Suspense fallback={<div>Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

// app/projects/settings/settings-content.tsx
'use client';
import { useSearchParams } from 'next/navigation';

export function SettingsContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'general';

  return (
    <div>
      <h1>Settings</h1>
      <TabPanel activeTab={tab} />
    </div>
  );
}

// app/feed/page.tsx
'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// SWR deduplicates the /api/posts request automatically — one fetch, two consumers
export function FeedPage() {
  const { data: posts = [] } = useSWR('/api/posts', fetcher);

  const trending = useMemo(
    () => posts.filter((p: any) => p.trending),
    [posts],
  );

  return (
    <div>
      <PostList posts={posts} />
      <TrendingSidebar posts={trending} />
    </div>
  );
}

// app/actions/project-actions.ts
'use server';
import { z } from 'zod';
import { auth } from '@/lib/auth';

// Zod schemas — server actions are public HTTP endpoints, never trust input
const updateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  budget: z.number().nonnegative(),
  status: z.enum(['active', 'archived', 'draft']),
});

const deleteProjectSchema = z.object({
  projectId: z.string().uuid(),
});

export async function updateProject(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const parsed = updateProjectSchema.parse({
    name: formData.get('name'),
    budget: Number(formData.get('budget')),
    status: formData.get('status'),
  });

  await db.projects.update(parsed);
  return { success: true };
}

export async function deleteProject(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const { projectId } = deleteProjectSchema.parse({
    projectId: formData.get('projectId'),
  });

  await db.projects.delete(projectId);
  return { success: true };
}

// app/projects/edit-form.tsx
'use client';
import { useActionState } from 'react';
import { updateProject } from '@/app/actions/project-actions';

interface FormState {
  success: boolean;
  error: string;
}

const initialState: FormState = { success: false, error: '' };

// useActionState replaces manual useState pending/error/success pattern
// Works with progressive enhancement (form submits without JS)
export function ProjectEditForm({ project }: { project: Project }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      try {
        await updateProject(formData);
        return { success: true, error: '' };
      } catch {
        return { success: false, error: 'Update failed' };
      }
    },
    initialState,
  );

  return (
    <form action={formAction}>
      <input name="name" defaultValue={project.name} />
      <input name="budget" type="number" defaultValue={project.budget} />
      <select name="status" defaultValue={project.status}>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
        <option value="draft">Draft</option>
      </select>
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
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
      {members.map(member => (
        // Stable key (member.id) — never use index for reorderable/editable lists
        <li key={member.id}>
          {editingId === member.id ? (
            <MemberEditForm member={member} onDone={() => setEditingId(null)} />
          ) : (
            <MemberCard
              member={member}
              onEdit={() => setEditingId(member.id)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
```
