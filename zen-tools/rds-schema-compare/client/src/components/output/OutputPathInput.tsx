import { useState } from 'react';
import { useComparisonStore } from '../../store/comparison-store';
import DirectoryBrowser from '../comparison/DirectoryBrowser';

export default function OutputPathInput() {
  const outputPath = useComparisonStore((s) => s.outputPath);
  const setOutputPath = useComparisonStore((s) => s.setOutputPath);
  const [browserOpen, setBrowserOpen] = useState(false);

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
        Output Directory
      </label>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={outputPath}
          onChange={(e) => setOutputPath(e.target.value)}
          placeholder="/path/to/output"
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => setBrowserOpen(true)}
          className="px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors shrink-0"
          title="Browse..."
        >
          &#128194;
        </button>
      </div>
      <DirectoryBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={setOutputPath}
        initialPath={outputPath || undefined}
      />
    </div>
  );
}
