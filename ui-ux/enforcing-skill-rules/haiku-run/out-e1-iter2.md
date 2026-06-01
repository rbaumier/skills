```tsx
import { useState } from 'react';
import { Search, Bell, Settings, ChevronRight, Plus, FolderOpen } from 'lucide-react';

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
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg hover:bg-white/5 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:ring-zinc-400 active:scale-[0.98]" aria-label="Notifications">
            <Bell className="w-5 h-5" aria-hidden="true" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/5 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:ring-zinc-400 active:scale-[0.98]" aria-label="Settings">
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8 gap-8">
          <div className="flex-1">
            <h2 className="text-3xl font-bold tracking-tight text-balance">Your Workspace</h2>
          </div>
          <button className="flex items-center gap-2 bg-zinc-800 text-zinc-100 px-4 py-2.5 rounded-lg font-bold hover:bg-zinc-700 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:ring-zinc-400 active:scale-[0.98] whitespace-nowrap">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Create Project
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:ring-zinc-400 transition-colors duration-200"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border border-white/10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:ring-zinc-400"
            />
            Include archived
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-zinc-500" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100 mb-1">No projects yet</h3>
            <p className="text-zinc-400 text-sm mb-6">Start by creating your first project to get organized.</p>
            <button className="flex items-center gap-2 bg-zinc-800 text-zinc-100 px-4 py-2.5 rounded-lg font-bold hover:bg-zinc-700 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:ring-zinc-400 active:scale-[0.98]">
              <Plus className="w-4 h-4" aria-hidden="true" />
              Create first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {filtered.map((project, idx) => (
              <div
                key={project.id}
                className={`p-6 bg-zinc-900 border border-white/10 rounded-xl hover:bg-zinc-800 transition-colors duration-200 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-zinc-950 focus-within:ring-zinc-400 ${
                  idx % 3 === 2 ? 'col-span-2' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-bold text-zinc-100 text-balance">{project.name}</h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                    project.status === 'active'
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}>
                    {project.status === 'active' ? '◆ Active' : 'Archived'}
                  </span>
                </div>
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">Progress</span>
                    <span className="text-zinc-200 font-bold tabular-nums">{project.progress}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-200 rounded-full"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Updated {project.updatedAt}</span>
                  <button className="text-sm text-zinc-300 hover:text-zinc-100 flex items-center gap-1 transition-colors duration-200 font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:ring-zinc-400 active:scale-[0.98]">
                    View project <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="mt-16 p-6 bg-zinc-900 border border-white/10 rounded-xl">
          <h3 className="text-lg font-bold mb-4 text-balance">Recent Activity</h3>
          <div className="space-y-1 divide-y divide-white/5">
            <div className="flex items-start gap-4 py-4 first:pt-0">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Plus className="w-4 h-4 text-zinc-400" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-zinc-200">
                  <span className="font-bold">Maya Patel</span> created "Q2 Launch Prep"
                </p>
                <p className="text-xs text-zinc-500 mt-1">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-4">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ChevronRight className="w-4 h-4 text-zinc-400" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-zinc-200">
                  <span className="font-bold">Devin Asato</span> completed phase 2 milestone
                </p>
                <p className="text-xs text-zinc-500 mt-1">5 hours ago</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
```
