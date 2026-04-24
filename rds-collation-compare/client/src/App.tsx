import { ConnectionPanel } from './components/ConnectionPanel';
import { ResultsPanel } from './components/ResultsPanel';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">RDS Collation Compare</h1>
          <p className="text-sm text-slate-600 mt-1">
            Compare database and table collations across RDS MySQL instances via Teleport
          </p>
        </header>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="col-span-3">
            <div className="sticky top-6">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                  Connection
                </h2>
                <ConnectionPanel />
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="col-span-9">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <ResultsPanel />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
