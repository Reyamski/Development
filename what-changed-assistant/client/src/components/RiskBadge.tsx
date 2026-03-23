import React from 'react';
import { Shield, AlertTriangle, AlertOctagon, Skull } from 'lucide-react';
import { RiskAssessment } from '../api/types';

interface RiskBadgeProps {
  risk: RiskAssessment | undefined;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export default function RiskBadge({ risk, size = 'md', showDetails = false }: RiskBadgeProps) {
  if (!risk) {
    return (
      <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 flex items-center gap-1">
        <Shield className="w-3 h-3" />
        No Risk
      </span>
    );
  }

  const { level, score, reasons } = risk;

  const config = {
    low: {
      bg: 'bg-green-900',
      border: 'border-green-600',
      text: 'text-green-200',
      icon: Shield,
      label: 'Low Risk',
    },
    medium: {
      bg: 'bg-yellow-900',
      border: 'border-yellow-600',
      text: 'text-yellow-200',
      icon: AlertTriangle,
      label: 'Medium Risk',
    },
    high: {
      bg: 'bg-orange-900',
      border: 'border-orange-600',
      text: 'text-orange-200',
      icon: AlertOctagon,
      label: 'High Risk',
    },
    critical: {
      bg: 'bg-red-900',
      border: 'border-red-600',
      text: 'text-red-200',
      icon: Skull,
      label: 'CRITICAL',
    },
  };

  const style = config[level];
  const Icon = style.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className={`inline-block ${showDetails ? 'space-y-2' : ''}`}>
      <span
        className={`${style.bg} ${style.text} ${sizeClasses[size]} rounded border ${style.border} flex items-center gap-1.5 font-semibold`}
        title={`Risk Score: ${score}/100`}
      >
        <Icon className={iconSizes[size]} />
        {style.label} ({score})
      </span>

      {showDetails && reasons.length > 0 && (
        <div className={`${style.bg} ${style.border} border rounded p-3 space-y-1`}>
          <div className={`text-xs font-semibold ${style.text}`}>Risk Factors:</div>
          <ul className={`text-xs ${style.text} list-disc list-inside space-y-0.5`}>
            {reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
