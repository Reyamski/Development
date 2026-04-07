import { useState } from 'react';

interface CommandPreviewProps {
  title: string;
  command: string | null;
  variant?: 'ghost' | 'ptosc';
}

export function CommandPreview({ title, command, variant = 'ghost' }: CommandPreviewProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!command) return null;

  function handleCopy() {
    navigator.clipboard.writeText(command!).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const accentColor = variant === 'ghost' ? 'text-violet-400' : 'text-orange-400';
  const headerBorder = variant === 'ghost' ? 'border-gray-800' : 'border-gray-800';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/60 transition-colors group"
      >
        <span className={`text-sm font-medium flex items-center gap-2 ${accentColor}`}>
          <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-xs">
            {open ? '▼' : '▶'}
          </span>
          {title}
        </span>
        <span className="text-xs text-gray-600 group-hover:text-gray-500 transition-colors">
          {open ? 'collapse' : 'expand'}
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className={`border-t ${headerBorder}`}>
          <div className="relative bg-gray-950 border-0 rounded-b-lg p-4">
            {/* Copy button — top right */}
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-700 text-xs font-medium rounded px-2.5 py-1 transition-colors"
            >
              {copied ? (
                <>
                  <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-400">Copied</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>

            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed pr-20 overflow-x-auto">
              {command}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
