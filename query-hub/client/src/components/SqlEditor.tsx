import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { editor } from 'monaco-editor';
import type * as Monaco from 'monaco-editor';
import {
  defineQueryHubMysqlTheme,
  QUERY_HUB_EDITOR_FONT,
  QUERY_HUB_MONACO_THEME_ID,
} from '../lib/monaco-theme';
import { useAppStore } from '../store/app-store';
import { useQueryStore } from '../store/query-store';

interface SqlEditorProps {
  onRun: () => void;
}

const MIN_H = 160;

function editorMaxPx(): number {
  if (typeof window === 'undefined') return 320;
  return Math.max(200, Math.floor(window.innerHeight * 0.34));
}

function editorDefaultPx(): number {
  if (typeof window === 'undefined') return 220;
  return Math.min(280, Math.max(180, Math.floor(window.innerHeight * 0.22)));
}

export function SqlEditor({ onRun }: SqlEditorProps) {
  const editorSql = useQueryStore((s) => s.editorSql);
  const setEditorSql = useQueryStore((s) => s.setEditorSql);
  const editorInsertQueue = useQueryStore((s) => s.editorInsertQueue);
  const consumeEditorInsert = useQueryStore((s) => s.consumeEditorInsert);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);

  const [height, setHeight] = useState(() => {
    const cap = editorMaxPx();
    try {
      const raw = localStorage.getItem('query-hub:sql-editor-h');
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n >= MIN_H) return Math.min(n, cap);
    } catch {
      /* ignore */
    }
    return Math.min(editorDefaultPx(), cap);
  });
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [lines, setLines] = useState(1);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (!editorInsertQueue || !editorRef.current || !monacoRef.current) return;
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    const sel = ed.getSelection();
    if (!sel) {
      consumeEditorInsert();
      return;
    }
    const range = new monaco.Range(sel.startLineNumber, sel.startColumn, sel.endLineNumber, sel.endColumn);
    ed.executeEdits('queryhub-schema-insert', [
      { range, text: editorInsertQueue.text, forceMoveMarkers: true },
    ]);
    ed.focus();
    consumeEditorInsert();
  }, [editorInsertQueue, consumeEditorInsert]);

  useEffect(() => {
    try {
      localStorage.setItem('query-hub:sql-editor-h', String(height));
    } catch {
      /* ignore */
    }
  }, [height]);

  useEffect(() => {
    const clamp = () => {
      const cap = editorMaxPx();
      setHeight((h) => Math.min(Math.max(MIN_H, h), cap));
      editorRef.current?.layout();
    };
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, []);

  const beforeMount: BeforeMount = useCallback((monaco) => {
    defineQueryHubMysqlTheme(monaco);
  }, []);

  const onMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      monaco.editor.setTheme(QUERY_HUB_MONACO_THEME_ID);

      const syncCursor = () => {
        const pos = editor.getPosition();
        if (pos) setCursor({ line: pos.lineNumber, col: pos.column });
        setLines(editor.getModel()?.getLineCount() ?? 1);
      };
      syncCursor();
      editor.onDidChangeCursorPosition(syncCursor);
      editor.onDidChangeModelContent(syncCursor);

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRun());
    },
    [onRun],
  );

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startY = e.clientY;
    const startH = height;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const cap = editorMaxPx();
      const next = Math.min(cap, Math.max(MIN_H, startH + (ev.clientY - startY)));
      setHeight(next);
      editorRef.current?.layout();
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [height]);

  return (
    <div className="flex flex-col min-h-0 rounded-xl overflow-hidden ring-1 ring-par-purple/30 shadow-[0_16px_48px_-14px_rgba(48,52,81,0.42)]">
      {/* Accent */}
      <div
        className="h-[3px] shrink-0 bg-gradient-to-r from-par-purple via-par-light-blue to-par-orange opacity-95"
        aria-hidden
      />

      {/* Chrome */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-[#0e0c18] border-b border-white/[0.07]">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-par-light-blue font-mono drop-shadow-[0_0_12px_rgba(140,159,255,0.25)]">
            SQL
          </span>
          <span className="rounded-lg bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold text-white/60 border border-white/[0.09] shadow-sm">
            MySQL
          </span>
          {selectedDatabase ? (
            <span
              className="truncate max-w-[12rem] rounded-lg bg-par-purple/22 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#e4e2ff] border border-par-purple/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              title={selectedDatabase}
            >
              {selectedDatabase}
            </span>
          ) : (
            <span className="text-[10px] text-white/40 font-medium">No database selected</span>
          )}
        </div>
      </div>

      <div className="relative bg-[#1a182c]">
        <Editor
          height={height}
          language="mysql"
          theme={QUERY_HUB_MONACO_THEME_ID}
          value={editorSql}
          onChange={(v) => setEditorSql(v ?? '')}
          beforeMount={beforeMount}
          onMount={onMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            fontLigatures: true,
            fontFamily: "ui-monospace, 'Cascadia Code', 'Segoe UI Mono', 'Consolas', monospace",
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            padding: { top: 12, bottom: 12 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'line',
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
            quickSuggestions: { other: true, comments: false, strings: true },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            wordBasedSuggestions: 'currentDocument',
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
          }}
        />
      </div>

      {/* Resize */}
      <button
        type="button"
        aria-label="Drag to resize SQL editor height"
        onMouseDown={startResize}
        className="group flex h-3 w-full shrink-0 cursor-row-resize items-center justify-center border-t border-white/[0.08] bg-[#12101f] hover:bg-[#1a182c] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-par-purple/50"
      >
        <span className="h-0.5 w-10 rounded-full bg-white/20 group-hover:bg-par-light-blue/60 transition-colors" />
      </button>

      {/* Status */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 bg-[#0c0a14] border-t border-white/[0.07] text-[11px] font-mono text-white/58">
        <span className="tabular-nums">
          <span className="text-white/42 font-medium">Ln</span> {cursor.line}
          <span className="mx-1.5 text-white/28">·</span>
          <span className="text-white/42 font-medium">Col</span> {cursor.col}
          <span className="mx-1.5 text-white/28">·</span>
          <span className="text-white/42 font-medium">{lines}</span> lines
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-white/48">
          <span className="text-white/40">UTF-8</span>
          <span className="hidden sm:inline text-white/30">·</span>
          <kbd className="hidden sm:inline rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-white/65 border border-white/[0.12]">
            ⌘/Ctrl+Enter
          </kbd>
          <span className="hidden sm:inline text-[10px] text-white/50">run</span>
        </span>
      </div>
    </div>
  );
}
