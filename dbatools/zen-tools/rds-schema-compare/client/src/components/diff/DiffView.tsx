import { useMemo } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { useComparisonStore } from '../../store/comparison-store';
import DiffHeader from './DiffHeader';

const diffStyles = {
  variables: {
    dark: {
      diffViewerBackground: '#0d1117',
      addedBackground: '#12261e',
      addedColor: '#7ee787',
      removedBackground: '#2d1215',
      removedColor: '#f85149',
      wordAddedBackground: '#1a4028',
      wordRemovedBackground: '#4d1f23',
      addedGutterBackground: '#12261e',
      removedGutterBackground: '#2d1215',
      gutterBackground: '#161b22',
      gutterBackgroundDark: '#0d1117',
      highlightBackground: '#1c2128',
      highlightGutterBackground: '#1c2128',
      codeFoldGutterBackground: '#161b22',
      codeFoldBackground: '#161b22',
      emptyLineBackground: '#0d1117',
      gutterColor: '#484f58',
      addedGutterColor: '#7ee787',
      removedGutterColor: '#f85149',
      codeFoldContentColor: '#8b949e',
      diffViewerTitleBackground: '#161b22',
      diffViewerTitleColor: '#8b949e',
      diffViewerTitleBorderColor: '#30363d',
    },
  },
  line: {
    fontSize: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  },
};

export default function DiffView() {
  const selectedKey = useComparisonStore((s) => s.selectedKey);
  const results = useComparisonStore((s) => s.results);

  const selected = useMemo(
    () => results.find((r) => r.key === selectedKey),
    [results, selectedKey]
  );

  if (!selected) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Select a file to view diff
      </div>
    );
  }

  const oldValue = selected.sourceRaw || '';
  const newValue = selected.targetRaw || '';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DiffHeader item={selected} />
      <div className="flex-1 overflow-auto">
        <ReactDiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={true}
          useDarkTheme={true}
          styles={diffStyles}
          compareMethod={DiffMethod.WORDS}
          leftTitle="Source"
          rightTitle="Target"
        />
      </div>
    </div>
  );
}
