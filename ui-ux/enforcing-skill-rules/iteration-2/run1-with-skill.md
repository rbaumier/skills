# Run 1 — With Skill (v2 eval)

```tsx
import { useState } from 'react';
import {
  Search,
  Bell,
  Settings,
  ChevronRight,
  Plus,
  FolderOpen,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Archive,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived';
  progress: number;
  updatedAt: string;
}

interface ProjectsDashboardProps {
  projects: Project[];
  /** Caller signals data is still loading */
  isLoading?: boolean;
  /** Non-null when the fetch failed */
  error?: string | null;
  /** Retry callback exposed by the parent */
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Design tokens applied throughout:
//
// Spacing scale (4-px base): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96
// Text colors (3 only): primary = zinc-100, secondary = zinc-400, muted = zinc-500
// Single accent: indigo (desaturated, < 80% saturation)
// Font weights (2 only): normal (400) + bold (700)
// Font: Geist — replaces Inter (AI Tell #19)
// Borders: semi-transparent white/10 — adapts across themes
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Skeleton — mirrors card layout so loading feels instant (AI Tell #51)
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div
      className="relative p-6 border border-white/10 rounded-2xl"
      aria-hidden="true"
    >
      {/* Title + badge row */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 rounded-md bg-zinc-800 animate-shimmer" />
        <div className="h-5 w-16 rounded-full bg-zinc-800 animate-shimmer" />
      </div>
      {/* Progress label row */}
      <div className="flex justify-between mb-2">
        <div className="h-4 w-16 rounded bg-zinc-800 animate-shimmer" />
        <div className="h-4 w-8 rounded bg-zinc-800 animate-shimmer" />
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-zinc-800 animate-shimmer mb-4" />
      {/* Footer row */}
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded bg-zinc-800 animate-shimmer" />
        <div className="h-4 w-20 rounded bg-zinc-800 animate-shimmer" />
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state — onboarding opportunity: icon + why + CTA (AI Tell #52)
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-24 px-6">
      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6">
        <FolderOpen className="w-7 h-7 text-indigo-400" aria-hidden="true" />
      </div>
      <p
        className="text-zinc-100 text-lg font-bold mb-1"
        style={{ textWrap: 'balance' }}
      >
        No projects yet
      </p>
      <p className="text-zinc-400 text-sm mb-6 max-w-[40ch] text-center">
        Create your first project to start tracking progress and collaborating
        with your team.
      </p>
      <button
        className="
          relative flex items-center gap-2 bg-indigo-600 text-white
          px-5 py-2.5 rounded-lg font-bold
          hover:bg-indigo-500
          active:scale-[0.98]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
          focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
          transition-colors duration-200
        "
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        New Project
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state — what went wrong, why, how to fix, retry (AI Tell #53)
// ---------------------------------------------------------------------------

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-24 px-6">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
        <AlertTriangle className="w-7 h-7 text-red-400" aria-hidden="true" />
      </div>
      <p
        className="text-zinc-100 text-lg font-bold mb-1"
        style={{ textWrap: 'balance' }}
      >
        Failed to load projects
      </p>
      <p className="text-zinc-400 text-sm mb-6 max-w-[48ch] text-center">
        {message ||
          'A network error prevented us from fetching your projects. Check your connection and try again.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="
            relative flex items-center gap-2 bg-zinc-800 text-zinc-100
            px-5 py-2.5 rounded-lg font-bold border border-white/10
            hover:bg-zinc-700
            active:scale-[0.98]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
            focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
            transition-colors duration-200
          "
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProjectsDashboard({
  projects,
  isLoading = false,
  error = null,
  onRetry,
}: ProjectsDashboardProps) {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (showArchived || p.status === 'active'),
  );

  return (
    <div
      className="min-h-[100dvh] bg-zinc-950 text-zinc-100 antialiased"
      style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
    >
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <div className="flex items-center gap-3">
          <button
            aria-label="Notifications"
            className="
              p-2.5 rounded-lg
              hover:bg-zinc-800
              active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
              focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
              transition-colors duration-150
            "
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            aria-label="Settings"
            className="
              p-2.5 rounded-lg
              hover:bg-zinc-800
              active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
              focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
              transition-colors duration-150
            "
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Main content                                                      */}
      {/* ----------------------------------------------------------------- */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Page title — left-aligned, asymmetric (DESIGN_VARIANCE 8) */}
        <div className="flex items-start justify-between mb-12">
          <div>
            <h2
              className="text-3xl font-bold tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Your Workspace
            </h2>
            <p className="text-zinc-400 mt-2 max-w-[50ch]">
              Track progress, review milestones, and ship together.
            </p>
          </div>
          <button
            className="
              relative flex items-center gap-2 bg-indigo-600 text-white
              px-5 py-2.5 rounded-lg font-bold
              hover:bg-indigo-500
              active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
              focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
              transition-colors duration-200
            "
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Project
          </button>
        </div>

        {/* Search + filter bar */}
        <div className="flex items-center gap-6 mb-8">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
              aria-hidden="true"
            />
            <label htmlFor="project-search" className="sr-only">
              Search projects
            </label>
            <input
              id="project-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="
                w-full pl-10 pr-4 py-2.5
                bg-zinc-900 border border-white/10 rounded-lg
                text-zinc-100 placeholder:text-zinc-500
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
                transition-colors duration-200
              "
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-white/10"
            />
            Show archived
          </label>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Content states: loading / error / empty / populated               */}
        {/* ----------------------------------------------------------------- */}

        {isLoading && <SkeletonGrid />}

        {!isLoading && error && (
          <ErrorState message={error} onRetry={onRetry} />
        )}

        {!isLoading && !error && filtered.length === 0 && <EmptyState />}

        {!isLoading && !error && filtered.length > 0 && (
          /* Asymmetric grid: 2fr + 1fr — avoids banned 3-col equal grid */
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
            {filtered.map((project) => (
              <div
                key={project.id}
                className="
                  group relative p-6 border border-white/10 rounded-2xl
                  hover:-translate-y-[1px] active:translate-y-0
                  transition-transform duration-200
                "
              >
                {/* Shadow pseudo-layer — opacity transition, no box-shadow animation */}
                <div
                  className="
                    pointer-events-none absolute inset-0 rounded-2xl
                    opacity-0 group-hover:opacity-100
                    transition-opacity duration-200
                  "
                  aria-hidden="true"
                  style={{
                    boxShadow:
                      '0 4px 12px rgba(17, 24, 39, 0.25), 0 12px 32px rgba(17, 24, 39, 0.15)',
                  }}
                />

                {/* Title + status */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-zinc-100">{project.name}</h3>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      project.status === 'active'
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {/* Icon so status doesn't rely on color alone */}
                    {project.status === 'active' ? (
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <Archive className="w-3 h-3" aria-hidden="true" />
                    )}
                    {project.status}
                  </span>
                </div>

                {/* Progress */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-zinc-400">Progress</span>
                    <span
                      className="text-zinc-100 font-bold"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {project.progress}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${project.progress}%` }}
                      role="progressbar"
                      aria-valuenow={project.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    Updated {project.updatedAt}
                  </span>
                  <button
                    className="
                      text-sm text-indigo-400 hover:text-indigo-300
                      flex items-center gap-1
                      active:scale-[0.98]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                      focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
                      transition-colors duration-150
                    "
                  >
                    Open project{' '}
                    <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Activity Feed — flat dividers, no nested cards                    */}
        {/* ----------------------------------------------------------------- */}
        <section className="mt-16 border border-white/10 rounded-2xl overflow-hidden">
          <h3 className="text-lg font-bold px-6 pt-6 pb-4">Activity Feed</h3>
          <div className="divide-y divide-white/5">
            <div className="flex items-start gap-3 px-6 py-4">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-zinc-100">
                  <span className="font-bold">Margaux Lefebvre</span> created a
                  new project
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-6 py-4">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2
                  className="w-4 h-4 text-indigo-400"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-sm text-zinc-100">
                  <span className="font-bold">Kofi Ansah</span> completed
                  milestone 3
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">5 hours ago</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ----------------------------------------------------------------- */}
      {/* Global styles: shimmer + reduced motion                           */}
      {/* ----------------------------------------------------------------- */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer {
          background: linear-gradient(
            90deg,
            rgb(39 39 42) 25%,
            rgb(52 52 56) 50%,
            rgb(39 39 42) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
```
