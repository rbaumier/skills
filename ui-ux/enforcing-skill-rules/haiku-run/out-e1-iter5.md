```tsx
import { useState } from 'react';
import { Search, Bell, Settings, ChevronRight, Plus, FolderOpen, AlertCircle } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived';
  progress: number;
  updatedAt: string;
}

export default function ProjectsDashboard({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) &&
    (showArchived || p.status === 'active')
  );

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  // Loading state: skeleton matches the populated layout
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 antialiased" style={{ fontFamily: 'Geist, system-ui, sans-serif' }}>
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <div className="flex items-center gap-3">
            <button aria-hidden="true" className="p-2 rounded-lg hover:bg-zinc-800 transition-colors duration-200">
              <Bell className="w-5 h-5" />
            </button>
            <button aria-hidden="true" className="p-2 rounded-lg hover:bg-zinc-800 transition-colors duration-200">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-[2fr_1fr] gap-6" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/10 p-5">
                <div className="skeleton h-5 w-3/4 rounded" />
                <div className="skeleton mt-3 h-3 w-full rounded" />
              </div>
            ))}
          </div>
          <style>{`.skeleton{background:linear-gradient(90deg,#1f2937 25%,#374151 50%,#1f2937 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}@keyframes shimmer{to{background-position:-200% 0}}@media(prefers-reduced-motion:reduce){.skeleton{animation:none}}`}</style>
        </main>
      </div>
    );
  }

  // Error state: recovery path with retry
  if (error) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 antialiased flex items-center justify-center px-6" style={{ fontFamily: 'Geist, system-ui, sans-serif' }}>
        <div className="rounded-xl border border-white/10 p-8 max-w-md">
          <AlertCircle className="h-10 w-10 text-red-500" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold text-zinc-100">Couldn't load projects</h2>
          <p className="mt-2 text-zinc-400">The server didn't respond. Check your connection and try again.</p>
          <button
            onClick={handleRetry}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-500 active:scale-[0.98] transition-colors duration-200"
          >
            Retry
          </button>
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
        <h1 className="text-2xl font-bold tracking-tight text-balance">Projects</h1>
        <div className="flex items-center gap-3">
          <button aria-label="Notifications" className="p-2 rounded-lg hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] transition-colors duration-200">
            <Bell className="w-5 h-5" aria-hidden="true" />
          </button>
          <button aria-label="Settings" className="p-2 rounded-lg hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] transition-colors duration-200">
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-balance text-zinc-100">Your Workspace</h2>
            <p className="text-zinc-400 mt-2 font-normal">Start a project to see it listed here.</p>
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] whitespace-nowrap transition-colors duration-200">
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Project
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <label htmlFor="project-search" className="sr-only">Search projects</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" aria-hidden="true" />
            <input
              id="project-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-colors duration-200"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border border-white/10 checked:bg-indigo-600 checked:border-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              aria-label="Show archived projects"
            />
            Show archived
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-white/10 p-8 max-w-md">
            <FolderOpen className="h-10 w-10 text-zinc-500" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-bold text-zinc-100 text-balance">No projects yet</h3>
            <p className="mt-2 text-zinc-400 font-normal">Projects you create will show up here.</p>
            <button className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-white font-bold hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] transition-colors duration-200">
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[2fr_1fr] gap-6">
            {filtered.map((project) => (
              <div
                key={project.id}
                className="p-5 bg-zinc-900 border border-white/10 rounded-xl hover:shadow-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 focus-within:ring-offset-zinc-950 transition-shadow duration-200 relative"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-zinc-100 text-balance">{project.name}</h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ml-2 flex-shrink-0 ${
                    project.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'bg-zinc-700/50 text-zinc-400 ring-1 ring-zinc-600/50'
                  }`}>
                    {project.status === 'active' ? '●' : '○'} {project.status}
                  </span>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400 font-normal">Progress</span>
                    <span className="text-zinc-100 font-bold tabular-nums">{project.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-xs text-zinc-500 font-normal">
                    Updated {project.updatedAt}
                  </span>
                  <button className="text-sm font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded px-1 active:scale-[0.98] transition-colors duration-200">
                    View <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="mt-12 p-6 bg-zinc-900 border border-white/10 rounded-xl">
          <h3 className="text-lg font-bold mb-4 text-zinc-100 text-balance">Activity Feed</h3>
          <div className="divide-y divide-white/10 space-y-0">
            <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-zinc-200 font-normal">
                  <span className="font-bold">Mara Okonkwo</span> created a new project
                </p>
                <p className="text-xs text-zinc-500 mt-1 font-normal">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
                <ChevronRight className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-zinc-200 font-normal">
                  <span className="font-bold">Devin Asato</span> completed milestone 3
                </p>
                <p className="text-xs text-zinc-500 mt-1 font-normal">5 hours ago</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
```
