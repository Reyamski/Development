import { useState } from 'react';
import { useAppStore } from '../store/app-store.js';

export function PostMortemViewer() {
  const { postMortemMarkdown, closePostMortem, activeIncident } = useAppStore();
  const [copied, setCopied] = useState(false);

  if (!postMortemMarkdown) return null;

  function handleDownload() {
    if (!postMortemMarkdown || !activeIncident) return;
    const blob = new Blob([postMortemMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postmortem-${activeIncident.incident_id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopy() {
    if (!postMortemMarkdown) return;
    void navigator.clipboard.writeText(postMortemMarkdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-950 border border-gray-800 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-blue-400">📄</span>
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Post-Mortem Draft</h2>
              {activeIncident && (
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{activeIncident.incident_id}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`text-sm border rounded-lg px-4 py-2 transition-colors font-medium ${
                copied
                  ? 'bg-green-950 border-green-800 text-green-400'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={handleDownload}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              Download .md
            </button>
            <button
              onClick={closePostMortem}
              className="text-gray-500 hover:text-gray-300 text-xl leading-none ml-1 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Document body — monospace throughout */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-950">
          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed tracking-wide">
            {postMortemMarkdown}
          </pre>
        </div>
      </div>
    </div>
  );
}
