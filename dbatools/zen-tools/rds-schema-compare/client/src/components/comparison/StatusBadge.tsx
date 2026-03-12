import type { DiffStatus } from '../../api/types';

const styles: Record<DiffStatus, string> = {
  added: 'bg-green-900/50 text-green-400 border-green-800',
  removed: 'bg-red-900/50 text-red-400 border-red-800',
  modified: 'bg-amber-900/50 text-amber-400 border-amber-800',
  unchanged: 'bg-gray-800/50 text-gray-500 border-gray-700',
};

export default function StatusBadge({ status }: { status: DiffStatus }) {
  return (
    <span
      className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${styles[status]}`}
    >
      {status}
    </span>
  );
}
