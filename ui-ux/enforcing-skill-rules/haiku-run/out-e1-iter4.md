```tsx
import { useState } from 'react';
import { Search, Bell, Settings, ChevronRight, Plus } from 'lucide-react';

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

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) &&
    (showArchived || p.status === 'active')
  );

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 antialiased" style={{ fontFamily: 'Geist, system-ui, sans-serif' }}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Projects</h1>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg hover:bg-white/10 active:scale-[0.98] transition-colors duration-200" aria-label="Notifications">
            <Bell className="w-5 h-5" aria-hidden="true" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/10 active:scale-[0.98] transition-colors duration-200" aria-label="Settings">
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8 gap-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-balance">Your Workspace</h2>
            <p className="text-zinc-400 mt-2">Track active and completed projects at a glance.</p>
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-500 active:scale-[0.98] transition-colors duration-200 whitespace-nowrap">
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Project
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6 flex-col sm:flex-row">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-colors duration-200"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border border-white/20 focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
            Show archived
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
          {filtered.slice(0, Math.ceil(filtered.length * 0.6)).map((project) => (
            <div
              key={project.id}
              className="relative p-5 bg-zinc-900 border border-white/10 rounded-lg shadow-md overflow-hidden group"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ boxShadow: 'inset 0 0 24px rgba(100, 116, 139, 0.1)' }} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-zinc-100">{project.name}</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    project.status === 'active'
                      ? 'bg-indigo-500/15 text-indigo-200'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}>
                    {project.status === 'active' && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
                    {project.status === 'active' ? 'Active' : 'Archived'}
                  </span>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">Progress</span>
                    <span className="text-zinc-200 font-bold tabular-nums">{project.progress}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Updated {project.updatedAt}</span>
                  <button className="text-sm text-indigo-400 hover:text-indigo-300 active:scale-[0.95] flex items-center gap-1 transition-colors duration-200 font-bold">
                    View details <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.slice(Math.ceil(filtered.length * 0.6)).map((project) => (
            <div key={project.id} className="p-5 bg-zinc-900 border border-white/10 rounded-lg shadow-md">
              <h3 className="font-bold text-zinc-100 mb-3">{project.name}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Progress</span>
                  <span className="tabular-nums">{project.progress}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${project.progress}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-indigo-400" aria-hidden="true" />
            </div>
            <p className="text-zinc-300 text-lg font-bold">No projects found</p>
            <p className="text-zinc-500 text-sm mt-1">Create your first project to get started.</p>
            <button className="mt-6 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-500 active:scale-[0.98] transition-colors duration-200">
              <Plus className="w-4 h-4" aria-hidden="true" />
              Create Project
            </button>
          </div>
        )}

        <section className="mt-12 p-6 bg-zinc-900 border border-white/10 rounded-lg">
          <h3 className="text-lg font-bold mb-4 text-balance">Recent Activity</h3>
          <div className="divide-y divide-white/5 space-y-0">
            <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200">
                  <span className="font-bold">Keiko Tanaka</span> created a new project
                </p>
                <p className="text-xs text-zinc-500 mt-1">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <ChevronRight className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200">
                  <span className="font-bold">Amir Patel</span> advanced to phase 2
                </p>
                <p className="text-xs text-zinc-500 mt-1">5 hours ago</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
```
