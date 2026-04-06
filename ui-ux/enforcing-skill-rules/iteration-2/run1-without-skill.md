# Run 1 — Without Skill (v2 eval)

```tsx
import { useState } from 'react';
import { Search, Bell, Settings, ChevronRight, Plus, FolderOpen, AlertCircle, CheckCircle2, Archive } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived';
  progress: number;
  updatedAt: string;
}

interface ProjectsDashboardProps {
  projects: Project[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function ProjectsDashboard({ projects, isLoading = false, error = null, onRetry }: ProjectsDashboardProps) {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) &&
    (showArchived || p.status === 'active')
  );

  if (isLoading) {
    return (
      <div
        className="min-h-[100dvh] bg-zinc-950 text-zinc-100 antialiased"
        style={{ fontFamily: 'Geist, system-ui, sans-serif' }}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="h-7 w-32 bg-zinc-800 rounded animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-zinc-800 rounded-lg animate-pulse" />
            <div className="h-9 w-9 bg-zinc-800 rounded-lg animate-pulse" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-8">
            <div className="h-9 w-64 bg-zinc-800 rounded animate-pulse mb-2" />
            <div className="h-5 w-80 bg-zinc-800/60 rounded animate-pulse" />
          </div>
          <div className="h-11 w-full bg-zinc-800/60 rounded-lg animate-pulse mb-6" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-5 bg-zinc-900 border border-white/10 rounded-2xl">
                <div className="h-5 w-3/4 bg-zinc-800 rounded animate-pulse mb-4" />
                <div className="h-2 w-full bg-zinc-800 rounded-full animate-pulse mb-4" />
                <div className="h-4 w-1/2 bg-zinc-800/60 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-[100dvh] bg-zinc-950 text-zinc-100 antialiased flex items-center justify-center"
        style={{ fontFamily: 'Geist, system-ui, sans-serif' }}
      >
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-xl font-bold tracking-tight mb-2">Failed to load projects</h2>
          <p className="text-zinc-400 mb-6">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-500 active:scale-[0.98] transition-colors duration-200"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] bg-zinc-950 text-zinc-100 antialiased"
      style={{ fontFamily: 'Geist, system-ui, sans-serif' }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <div className="flex items-center gap-3">
          <button
            aria-label="Notifications"
            className="p-2 rounded-lg hover:bg-zinc-800 active:scale-[0.98] transition-colors duration-200"
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            aria-label="Settings"
            className="p-2 rounded-lg hover:bg-zinc-800 active:scale-[0.98] transition-colors duration-200"
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl ml-6 lg:ml-auto lg:mr-auto px-6 py-12">
        <div className="flex items-start justify-between mb-12">
          <div>
            <h2
              className="text-3xl font-bold tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Your Workspace
            </h2>
            <p className="text-zinc-400 mt-2">
              {projects.length} projects — {projects.filter(p => p.status === 'active').length} active
            </p>
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-indigo-500 active:scale-[0.98] transition-colors duration-200">
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Project
          </button>
        </div>

        <div className="flex items-center gap-6 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" aria-hidden="true" />
            <label htmlFor="project-search" className="sr-only">Search projects</label>
            <input
              id="project-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-lg text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-colors duration-200"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-white/10 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            />
            Show archived
          </label>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
          {filtered.map((project) => (
            <div
              key={project.id}
              className="group relative p-6 bg-zinc-900 border border-white/10 rounded-2xl"
            >
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ boxShadow: '0 8px 24px rgba(30, 27, 75, 0.25)' }}
                aria-hidden="true"
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-zinc-100">{project.name}</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                    project.status === 'active'
                      ? 'bg-indigo-500/10 text-indigo-300'
                      : 'bg-white/5 text-zinc-400'
                  }`}>
                    {project.status === 'active'
                      ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      : <Archive className="w-3 h-3" aria-hidden="true" />
                    }
                    {project.status}
                  </span>
                </div>
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-1">
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
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    Updated {project.updatedAt}
                  </span>
                  <button className="text-sm text-indigo-400 hover:text-indigo-300 active:scale-[0.98] flex items-center gap-1 transition-colors duration-200">
                    Open project <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-20 max-w-sm mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="w-8 h-8 text-zinc-400" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">No projects found</h3>
            <p className="text-zinc-400 text-sm mb-6">
              {query
                ? `No results for "${query}". Try a different search term.`
                : 'Create your first project to get started.'}
            </p>
            <button
              onClick={() => { setQuery(''); setShowArchived(false); }}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-500 active:scale-[0.98] transition-colors duration-200"
            >
              {query ? 'Clear search' : 'New Project'}
            </button>
          </div>
        )}

        <section className="mt-16 p-6 bg-zinc-900 border border-white/10 rounded-2xl">
          <h3 className="text-xl font-bold mb-6">Activity Feed</h3>
          <div className="divide-y divide-white/5">
            <div className="flex items-start gap-3 py-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-zinc-100">
                  <span className="font-bold">Margaux Lefort</span> created a new project
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                <ChevronRight className="w-4 h-4 text-indigo-300" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-zinc-100">
                  <span className="font-bold">Tomas Rydell</span> completed milestone 3
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">5 hours ago</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
```
