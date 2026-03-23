import Editor from '@monaco-editor/react';
import { useQueryStore } from '../store/query-store';

interface SqlEditorProps {
  onRun: () => void;
}

export function SqlEditor({ onRun }: SqlEditorProps) {
  const editorSql = useQueryStore((s) => s.editorSql);
  const setEditorSql = useQueryStore((s) => s.setEditorSql);

  return (
    <div className="min-h-[200px] flex-1 flex flex-col border border-par-light-purple/50 rounded-lg overflow-hidden">
      <Editor
        height="280px"
        defaultLanguage="mysql"
        theme="vs-dark"
        value={editorSql}
        onChange={(v) => setEditorSql(v ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        }}
        onMount={(editor, monaco) => {
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRun());
        }}
      />
    </div>
  );
}
