import { useComparisonStore } from '../../store/comparison-store';

export default function OutputModeToggle() {
  const singleFile = useComparisonStore((s) => s.singleFile);
  const setSingleFile = useComparisonStore((s) => s.setSingleFile);

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          type="radio"
          checked={singleFile}
          onChange={() => setSingleFile(true)}
          className="accent-blue-500"
        />
        Single file
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          type="radio"
          checked={!singleFile}
          onChange={() => setSingleFile(false)}
          className="accent-blue-500"
        />
        Individual files
      </label>
    </div>
  );
}
