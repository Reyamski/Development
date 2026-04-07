import type { Severity } from '../api/types';

interface FlagBadgeProps {
  severity: Severity;
  label?: string;
}

const SEVERITY_STYLES: Record<Severity, string> = {
  HIGH:   'bg-red-500/10 text-red-400 border-red-500/30',
  MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  LOW:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

const SEVERITY_DOTS: Record<Severity, string> = {
  HIGH:   'bg-red-400',
  MEDIUM: 'bg-yellow-400',
  LOW:    'bg-blue-400',
};

export function FlagBadge({ severity, label }: FlagBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${SEVERITY_STYLES[severity]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_DOTS[severity]}`}></span>
      {label ?? severity}
    </span>
  );
}

interface RiskBadgeProps {
  risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
}

const RISK_STYLES: Record<string, string> = {
  HIGH:   'bg-red-500/10 text-red-400 border-red-500/30',
  MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  LOW:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  CLEAN:  'bg-green-500/10 text-green-400 border-green-500/30',
};

const RISK_DOTS: Record<string, string> = {
  HIGH:   'bg-red-400',
  MEDIUM: 'bg-yellow-400',
  LOW:    'bg-blue-400',
  CLEAN:  'bg-green-400',
};

export function RiskBadge({ risk }: RiskBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-semibold ${RISK_STYLES[risk]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${RISK_DOTS[risk]}`}></span>
      {risk}
    </span>
  );
}
