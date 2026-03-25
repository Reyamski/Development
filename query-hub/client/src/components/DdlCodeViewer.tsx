import Editor, { type BeforeMount } from '@monaco-editor/react';
import { useCallback } from 'react';
import {
  defineQueryHubMysqlTheme,
  QUERY_HUB_EDITOR_FONT,
  QUERY_HUB_MONACO_THEME_ID,
} from '../lib/monaco-theme';

interface DdlCodeViewerProps {
  value: string;
  className?: string;
}

/** Read-only DDL with the same theme + font as the main SQL editor */
export function DdlCodeViewer({ value, className = '' }: DdlCodeViewerProps) {
  const beforeMount: BeforeMount = useCallback((monaco) => {
    defineQueryHubMysqlTheme(monaco);
  }, []);

  return (
    <div
      className={`qh-ddl-monaco overflow-hidden rounded-lg ring-1 ring-white/[0.08] shadow-inner ${className}`}
      style={{ minHeight: 220, height: 'min(58vh, 520px)' }}
    >
      <Editor
        height="100%"
        language="mysql"
        theme={QUERY_HUB_MONACO_THEME_ID}
        value={value}
        beforeMount={beforeMount}
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineHeight: 21,
          fontLigatures: true,
          fontFamily: QUERY_HUB_EDITOR_FONT,
          lineNumbers: 'on',
          lineNumbersMinChars: 4,
          glyphMargin: false,
          folding: true,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          padding: { top: 12, bottom: 12 },
          smoothScrolling: true,
          renderLineHighlight: 'line',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          cursorBlinking: 'solid',
          contextmenu: true,
          quickSuggestions: false,
          links: false,
        }}
      />
    </div>
  );
}
