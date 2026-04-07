import type { AuditUser } from '../api/types';
import { FlagBadge } from './FlagBadge';

interface GrantsPanelProps {
  user: AuditUser;
}

const RULE_LABELS: Record<string, string> = {
  SUPER_PRIVILEGE: 'SUPER Privilege',
  ALL_PRIVILEGES_GLOBAL: 'ALL PRIVILEGES on *.*',
  GRANT_OPTION_GLOBAL: 'GRANT OPTION on *.*',
  FILE_PRIVILEGE: 'FILE Privilege',
  DANGEROUS_INFRA_PRIV: 'Dangerous Infra Privilege',
  WILDCARD_HOST: 'Wildcard Host (%)',
  PASSWORD_EXPIRED: 'Password Expired',
  ALL_PRIVILEGES_SCHEMA: 'ALL PRIVILEGES on Schema',
  USER_MANAGEMENT_PRIV: 'User Management Privilege',
  NO_PASSWORD_LIFETIME: 'No Password Expiry Policy',
  WILDCARD_HOST_SELECT_ONLY: 'Wildcard Host (SELECT only)',
  DUPLICATE_USERNAME: 'Duplicate Username',
};

export function GrantsPanel({ user }: GrantsPanelProps) {
  return (
    <div className="bg-gray-900 border-t border-gray-800 px-6 py-5 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Flags */}
        <div>
          {user.flags.length > 0 ? (
            <>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Flags ({user.flags.length})
              </h4>
              <div className="space-y-2">
                {user.flags.map((flag, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border
                      ${flag.severity === 'HIGH'
                        ? 'bg-red-500/5 border-red-500/20'
                        : flag.severity === 'MEDIUM'
                          ? 'bg-yellow-500/5 border-yellow-500/20'
                          : 'bg-blue-500/5 border-blue-500/20'
                      }`}
                  >
                    <FlagBadge severity={flag.severity} label={RULE_LABELS[flag.rule] ?? flag.rule} />
                    <span className="text-xs text-gray-400 leading-5 pt-0.5">{flag.detail}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              No flags — account is clean
            </div>
          )}
        </div>

        {/* Right column: Account Details */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Account Details
          </h4>
          <dl className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700/60">
            <div className="flex items-center justify-between px-4 py-2.5">
              <dt className="text-xs text-gray-500">Auth Plugin</dt>
              <dd className="text-xs font-mono text-gray-200">{user.plugin}</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <dt className="text-xs text-gray-500">Password Expired</dt>
              <dd className={`text-xs font-medium ${user.passwordExpired ? 'text-red-400' : 'text-gray-300'}`}>
                {user.passwordExpired ? 'Yes' : 'No'}
              </dd>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <dt className="text-xs text-gray-500">Account Locked</dt>
              <dd className={`text-xs font-medium ${user.accountLocked ? 'text-red-400' : 'text-gray-300'}`}>
                {user.accountLocked ? 'Yes' : 'No'}
              </dd>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <dt className="text-xs text-gray-500">Password Lifetime</dt>
              <dd className={`text-xs font-medium ${user.passwordLifetime === null ? 'text-yellow-400' : 'text-gray-300'}`}>
                {user.passwordLifetime !== null ? `${user.passwordLifetime} days` : 'NULL — no rotation'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* SHOW GRANTS */}
      {user.grants.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            SHOW GRANTS
          </h4>
          <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {user.grants.map(g => g + ';').join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}
