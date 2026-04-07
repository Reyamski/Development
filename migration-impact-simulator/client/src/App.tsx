import { InstancePicker } from './components/InstancePicker';
import { DdlInput } from './components/DdlInput';
import { ResultCard } from './components/ResultCard';
import { useEffect } from 'react';
import { sendShutdown } from './api/client';

export default function App() {
  // Cleanup tunnels when page closes
  useEffect(() => {
    const handler = () => sendShutdown();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-col overflow-hidden">

      {/* ── Page header ── */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 shrink-0 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold tracking-tight">MIS</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-white leading-tight">
            Migration Impact Simulator
          </h1>
          <p className="text-xs text-gray-500 truncate">
            Predict lock duration and recommend the safest migration strategy before you run anything
          </p>
        </div>
      </header>

      {/* ── Two-column body ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel: instance picker + DDL input */}
        <aside className="w-80 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col overflow-y-auto">
          <div className="flex-1 p-5 space-y-6">

            {/* Connection section */}
            <section>
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Connection
              </h2>
              <InstancePicker />
            </section>

            {/* DDL input section */}
            <section className="border-t border-gray-800 pt-5">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                DDL Statement
              </h2>
              <DdlInput />
            </section>

            {/* How it works */}
            <section className="border-t border-gray-800 pt-5">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                How it works
              </h2>
              <ol className="space-y-2.5">
                {[
                  'Select a cluster and instance',
                  'Paste your ALTER TABLE statement',
                  'Click Analyze — we query information_schema (read-only)',
                  'Get INSTANT / INPLACE / gh-ost / pt-osc recommendation with lock estimate',
                ].map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-xs text-gray-500">
                    <span className="text-blue-400 font-medium shrink-0">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Safety note */}
            <section className="border-t border-gray-800 pt-4">
              <p className="text-xs text-gray-700 leading-relaxed">
                Zero writes to the target database. All analysis uses{' '}
                <code className="font-mono text-gray-600">MAX_EXECUTION_TIME(5000)</code>.
              </p>
            </section>
          </div>
        </aside>

        {/* Right panel: results */}
        <main className="flex-1 overflow-y-auto p-6 min-w-0">
          <ResultCard />
        </main>

      </div>
    </div>
  );
}
