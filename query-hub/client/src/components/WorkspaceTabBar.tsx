import { useWorkspaceStore } from '../store/workspace-store';
import { useWorkspaceTabs } from '../hooks/useWorkspaceTabs';

export function WorkspaceTabBar() {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const { switchTab, addTab, removeTab } = useWorkspaceTabs();

  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
      {tabs.map((t) => {
        const active = t.id === activeTabId;
        return (
          <div
            key={t.id}
            className={`group flex items-stretch rounded-xl border text-left shrink-0 max-w-[12rem] transition-all duration-200 ${
              active
                ? 'border-white bg-white text-par-navy shadow-qh-sm ring-2 ring-par-light-blue/25'
                : 'border-white/25 bg-white/[0.06] text-white/90 hover:bg-white/[0.11] hover:border-white/35'
            }`}
          >
            <button
              type="button"
              className="px-2.5 py-1.5 text-[11px] font-bold truncate min-w-0 flex-1 text-left"
              onClick={() => void switchTab(t.id)}
              title={t.label}
            >
              {t.label}
            </button>
            {tabs.length > 1 && (
              <button
                type="button"
                className={`px-1.5 rounded-r-[10px] text-sm font-light leading-none border-l transition-colors ${
                  active
                    ? 'border-par-light-purple/35 text-par-text/35 hover:text-red-600 hover:bg-red-50'
                    : 'border-white/15 text-white/55 hover:text-white hover:bg-red-500/80'
                }`}
                aria-label={`Close ${t.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  void removeTab(t.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => void addTab()}
        className="shrink-0 px-2.5 py-1.5 rounded-xl border border-dashed border-white/35 text-white/85 text-[11px] font-bold hover:bg-white/[0.08] hover:border-white/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        title="New workspace tab"
      >
        + Tab
      </button>
      <button
        type="button"
        onClick={() => void addTab({ clone: true })}
        className="shrink-0 px-2.5 py-1.5 rounded-xl border border-white/22 text-white/75 text-[11px] font-bold hover:bg-white/[0.08] hidden sm:inline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        title="Duplicate current tab"
      >
        Clone
      </button>
    </div>
  );
}
