import type { BeforeMount } from '@monaco-editor/react';

type MonacoApi = Parameters<BeforeMount>[0];

export const QUERY_HUB_MONACO_THEME_ID = 'queryhub-mysql';

/** Shared stack — load JetBrains Mono in index.html */
export const QUERY_HUB_EDITOR_FONT =
  "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, 'Segoe UI Mono', Consolas, monospace";

export function defineQueryHubMysqlTheme(monaco: MonacoApi): void {
  monaco.editor.defineTheme(QUERY_HUB_MONACO_THEME_ID, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b6788', fontStyle: 'italic' },
      { token: 'comment.sql', foreground: '6b6788', fontStyle: 'italic' },
      { token: 'keyword.sql', foreground: 'c4a8ff' },
      { token: 'keyword', foreground: 'c4a8ff' },
      { token: 'string.sql', foreground: '7ec8e8' },
      { token: 'string', foreground: '7ec8e8' },
      { token: 'number.sql', foreground: 'ffb38a' },
      { token: 'number', foreground: 'ffb38a' },
      { token: 'operator.sql', foreground: '9da0c4' },
      { token: 'operator', foreground: '9da0c4' },
      { token: 'identifier.sql', foreground: 'e8e6f7' },
      { token: 'identifier', foreground: 'e8e6f7' },
      { token: 'type.sql', foreground: '8ad7ff' },
      { token: 'predefined.sql', foreground: 'b8a8ff' },
      { token: 'delimiter.parenthesis', foreground: 'a8acc8' },
      { token: 'delimiter.square', foreground: 'a8acc8' },
    ],
    colors: {
      'editor.background': '#161422',
      'editor.foreground': '#ebe9f7',
      'editorGutter.background': '#12101c',
      'editorLineNumber.foreground': '#4c4868',
      'editorLineNumber.activeForeground': '#8b84c8',
      'editorCursor.foreground': '#8c9fff',
      'editor.selectionBackground': '#6864d155',
      'editor.inactiveSelectionBackground': '#6864d133',
      'editor.lineHighlightBackground': '#1e1c2e',
      'editorLineHighlightBorder': '#00000000',
      'scrollbarSlider.background': '#6864d14d',
      'scrollbarSlider.hoverBackground': '#6864d170',
      'scrollbarSlider.activeBackground': '#6864d199',
      'editorWidget.background': '#1e1c2e',
      'editorWidget.border': '#6864d144',
      'editorIndentGuide.background': '#3d3a5c2a',
      'editorIndentGuide.activeBackground': '#6864d144',
      'editorBracketMatch.background': '#6864d11f',
      'editorBracketMatch.border': '#6864d166',
      'editorWhitespace.foreground': '#3d3a5544',
    },
  });
}
