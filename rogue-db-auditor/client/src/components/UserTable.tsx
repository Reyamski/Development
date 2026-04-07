import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { RiskBadge, FlagBadge } from './FlagBadge';
import { GrantsPanel } from './GrantsPanel';
import type { AuditUser, RiskLevel } from '../api/types';

function sortByRisk(users: AuditUser[]): AuditUser[] {
  const order: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, CLEAN: 3 };
  return [...users].sort((a, b) => order[a.riskLevel] - order[b.riskLevel]);
}

const PLUGIN_SHORT: Record<string, string> = {
  mysql_native_password: 'native',
  caching_sha2_password: 'sha2',
  auth_socket: 'socket',
  sha256_password: 'sha256',
};

function PluginBadge({ plugin }: { plugin: string }) {
  const label = PLUGIN_SHORT[plugin] ?? plugin.replace('mysql_', '').replace('_password', '');
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs font-mono text-gray-400">
      {label}
    </span>
  );
}

export function UserTable() {
  const { auditResult, riskFilter, searchQuery } = useAppStore();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  if (!auditResult) return null;

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  let users = auditResult.users;

  // Apply risk filter
  if (riskFilter !== 'ALL') {
    users = users.filter(u => u.riskLevel === riskFilter);
  }

  // Apply search
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    users = users.filter(u =>
      u.user.toLowerCase().includes(q) ||
      u.host.toLowerCase().includes(q),
    );
  }

  users = sortByRisk(users);

  // Separate system users (system users come with no flags but the data may not have an isSystem flag;
  // they are filtered out of the audit in riskFilter context — treat CLEAN users with no flags as
  // potentially clean but keep them in main table. The server already excludes system users from `users`
  // array per the spec, so no additional separation is needed unless the store surfaces them separately).
  // Since AuditUser doesn't have an `isSystem` field, we render all returned users as-is.

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-600">
        <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
        </svg>
        <p className="text-sm text-gray-500">No users match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 w-8 text-left"></th>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">User</th>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Host</th>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Auth Plugin</th>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Status</th>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Risk</th>
            <th className="text-xs text-gray-500 uppercase tracking-wider px-4 py-3 text-left">Flags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {users.map(user => {
            const key = `${user.user}@${user.host}`;
            const expanded = expandedRows.has(key);

            const chips: { label: string; style: string }[] = [];
            if (user.accountLocked) chips.push({ label: 'Locked', style: 'bg-red-500/10 text-red-400 border-red-500/30' });
            if (user.passwordExpired) chips.push({ label: 'Pwd Expired', style: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' });

            // Up to 2 preview flags for the collapsed row
            const previewFlags = user.flags.slice(0, 2);
            const extraFlags = user.flags.length - 2;

            return (
              <>
                <tr
                  key={key}
                  className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                  onClick={() => toggleRow(key)}
                >
                  {/* Expand chevron */}
                  <td className="px-4 py-3 text-gray-600">
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </td>

                  {/* User */}
                  <td className="px-4 py-3 font-mono text-gray-100 font-medium text-sm">
                    {user.user}
                  </td>

                  {/* Host */}
                  <td className="px-4 py-3 font-mono text-sm">
                    <span className={user.host === '%' ? 'text-yellow-400' : 'text-gray-400'}>
                      {user.host}
                    </span>
                  </td>

                  {/* Auth Plugin badge */}
                  <td className="px-4 py-3">
                    <PluginBadge plugin={user.plugin} />
                  </td>

                  {/* Account status chips */}
                  <td className="px-4 py-3">
                    {chips.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {chips.map((c, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-medium ${c.style}`}
                          >
                            {c.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">Active</span>
                    )}
                  </td>

                  {/* Risk badge */}
                  <td className="px-4 py-3">
                    <RiskBadge risk={user.riskLevel} />
                  </td>

                  {/* Flag count / preview */}
                  <td className="px-4 py-3">
                    {user.flags.length === 0 ? (
                      <span className="text-xs text-gray-600">—</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {previewFlags.map((flag, i) => (
                          <FlagBadge key={i} severity={flag.severity} />
                        ))}
                        {extraFlags > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5">
                            +{extraFlags}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>

                {/* Expanded detail panel */}
                {expanded && (
                  <tr key={`${key}-expanded`}>
                    <td colSpan={7} className="p-0">
                      <GrantsPanel user={user} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
