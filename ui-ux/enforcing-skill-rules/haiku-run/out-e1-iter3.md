```tsx
import { useState } from 'react';
import { Search, Bell, Settings, ChevronRight, Plus, AlertCircle } from 'lucide-react';

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
    <div
      className="min-h-[100dvh] bg-zinc-950 text-zinc-100 antialiased"
      style={{ fontFamily: 'Geist, system-ui, sans-serif' }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Projects</h1>
        <div className="flex items-center gap-3">
          <button 
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 active:scale-[0.98]"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
          </button>
          <button 
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 active:scale-[0.98]"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="px-6 py-8">
        <div className="flex flex-col gap-8 mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-balance mb-2">Your Workspace</h2>
            <p className="text-zinc-400">Track project progress and collaborate with your team.</p>
          </div>
          <button className="w-fit flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-500 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 active:scale-[0.98]">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Create project
          </button>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-colors duration-200"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-white/20 focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
            Show archived
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-indigo-400" aria-hidden="true" />
            </div>
            <p className="text-zinc-200 font-bold mb-1">No projects found</p>
            <p className="text-zinc-400 text-sm mb-6">Start fresh or adjust your filters.</p>
            <button className="text-indigo-400 hover:text-indigo-300 text-sm font-bold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[2fr_1fr] gap-6 mb-12">
            {filtered.slice(0, 2).map((project) => (
              <div
                key={project.id}
                className="relative p-6 bg-zinc-900 border border-white/10 rounded-lg overflow-hidden hover:border-white/20 transition-colors duration-200 group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-bold text-zinc-100 text-lg">{project.name}</h3>
                    <span className={`text-xs font-bold px-2.5 py-1.5 rounded-full flex items-center gap-1 ${
                      project.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 after:content-[""] after:w-1.5 after:h-1.5 after:rounded-full after:bg-emerald-400'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-400">Progress</span>
                      <span className="text-zinc-200 font-bold tabular-nums">{project.progress}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      Updated {project.updatedAt}
                    </span>
                    <button className="text-sm text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]">
                      View project <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length > 2 && (
              <div className="p-6 bg-zinc-900 border border-white/10 rounded-lg flex flex-col items-center justify-center">
                <p className="text-zinc-400 text-sm font-bold mb-3">{filtered.length - 2} more</p>
                <button className="text-indigo-400 hover:text-indigo-300 text-sm font-bold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]">
                  See all
                </button>
              </div>
            )}
          </div>
        )}

        <section className="p-6 bg-zinc-900 border border-white/10 rounded-lg">
          <h3 className="text-lg font-bold mb-6 text-balance">Recent activity</h3>
          <div className="space-y-4 divide-y divide-white/5">
            <div className="flex items-start gap-4 pt-0">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Plus className="w-4 h-4 text-indigo-300" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200">
                  <span className="font-bold">Marina Okonkwo</span> started Design System project
                </p>
                <p className="text-xs text-zinc-500 mt-1">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-4 pt-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <ChevronRight className="w-4 h-4 text-emerald-300" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200">
                  <span className="font-bold">Devin Asato</span> completed milestone 3
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
