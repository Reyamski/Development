import { useAppStore } from '../store/app-store';
import type { RiskFilter } from '../store/app-store';

interface StatCardProps {
  count: number;
  label: string;
  iconColor: string;
  dotColor: string;
  ringColor: string;
  cardBg: string;
  cardBorder: string;
  filterValue: RiskFilter;
  activeFilter: RiskFilter;
  onClick: (f: RiskFilter) => void;
}

function StatCard({
  count,
  label,
  iconColor,
  dotColor,
  ringColor,
  cardBg,
  cardBorder,
  filterValue,
  activeFilter,
  onClick,
}: StatCardProps) {
  const isActive = activeFilter === filterValue;
  return (
    <button
      onClick={() => onClick(filterValue)}
      className={`flex-1 min-w-[130px] bg-gray-900 border rounded-lg p-5 text-left transition-all
        ${isActive
          ? `${cardBg} ${cardBorder} ring-2 ${ringColor}`
          : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/60'
        }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-semibold uppercase tracking-wider ${iconColor}`}>{label}</span>
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></span>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${iconColor}`}>{count}</div>
    </button>
  );
}

export function SummaryBar() {
  const { auditResult, riskFilter, setRiskFilter } = useAppStore();

  if (!auditResult) return null;

  const { summary } = auditResult;

  return (
    <div className="px-6 py-4 border-b border-gray-800 bg-gray-900">
      <div className="flex flex-wrap items-stretch gap-3">
        <StatCard
          count={summary.highRisk}
          label="High Risk"
          iconColor="text-red-400"
          dotColor="bg-red-400"
          ringColor="ring-red-500/40"
          cardBg="bg-red-500/10"
          cardBorder="border-red-500/30"
          filterValue="HIGH"
          activeFilter={riskFilter}
          onClick={setRiskFilter}
        />
        <StatCard
          count={summary.mediumRisk}
          label="Medium Risk"
          iconColor="text-yellow-400"
          dotColor="bg-yellow-400"
          ringColor="ring-yellow-500/40"
          cardBg="bg-yellow-500/10"
          cardBorder="border-yellow-500/30"
          filterValue="MEDIUM"
          activeFilter={riskFilter}
          onClick={setRiskFilter}
        />
        <StatCard
          count={summary.lowRisk}
          label="Low Risk"
          iconColor="text-blue-400"
          dotColor="bg-blue-400"
          ringColor="ring-blue-500/40"
          cardBg="bg-blue-500/10"
          cardBorder="border-blue-500/30"
          filterValue="LOW"
          activeFilter={riskFilter}
          onClick={setRiskFilter}
        />
        <StatCard
          count={summary.clean}
          label="Clean"
          iconColor="text-green-400"
          dotColor="bg-green-400"
          ringColor="ring-green-500/40"
          cardBg="bg-green-500/10"
          cardBorder="border-green-500/30"
          filterValue="CLEAN"
          activeFilter={riskFilter}
          onClick={setRiskFilter}
        />

        {/* System users — ghost card, not filterable */}
        <div className="flex-1 min-w-[130px] bg-gray-900 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">System</span>
            <span className="w-2.5 h-2.5 rounded-full bg-gray-600"></span>
          </div>
          <div className="text-3xl font-bold tabular-nums text-gray-500">{summary.systemUsers}</div>
          <div className="text-xs text-gray-600 mt-1">excluded from audit</div>
        </div>

        {/* All users toggle + metadata */}
        <div className="flex flex-col justify-between ml-auto self-stretch min-w-[110px]">
          <button
            onClick={() => setRiskFilter('ALL')}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all
              ${riskFilter === 'ALL'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              }`}
          >
            All ({summary.totalUsers - summary.systemUsers})
          </button>
          <div className="text-xs text-gray-600 text-right mt-2">
            Audited {new Date(auditResult.auditedAt).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
