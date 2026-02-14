'use client';

import { FilePreview as FilePreviewType, ExcelPreview, PythonPreview, WordPreview, ScannedFile } from '@/types/demo';

interface FilePreviewProps {
  file: ScannedFile;
  preview: FilePreviewType;
}

export function FilePreview({ file, preview }: FilePreviewProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* File Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className="text-xl">{file.icon}</span>
        <span className="font-medium text-gray-900">{file.name}</span>
        <span className="ml-auto text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
          {file.type.toUpperCase()}
        </span>
      </div>

      {/* Preview Content */}
      <div className="p-4">
        {preview.type === 'excel' && <ExcelPreviewComponent preview={preview} />}
        {preview.type === 'python' && <PythonPreviewComponent preview={preview} />}
        {preview.type === 'word' && <WordPreviewComponent preview={preview} />}
      </div>
    </div>
  );
}

// ========== Excel Preview ==========

function ExcelPreviewComponent({ preview }: { preview: ExcelPreview }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-mono">
        {/* Header Row */}
        <thead>
          <tr className="bg-gray-100">
            <th className="w-12 px-3 py-2 text-left text-gray-500 font-normal border-r border-gray-200"></th>
            {preview.headers.slice(1).map((header, i) => (
              <th
                key={i}
                className="px-4 py-2 text-center text-gray-700 font-semibold border-r border-gray-200 last:border-r-0"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        {/* Data Rows */}
        <tbody>
          {preview.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-gray-200">
              <td className="px-3 py-2 text-gray-400 bg-gray-50 border-r border-gray-200 text-center">
                {row.rowNumber}
              </td>
              {row.cells.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-4 py-2 text-center border-r border-gray-200 last:border-r-0 ${
                    cell.isHighlighted
                      ? 'bg-yellow-100 text-yellow-800 font-semibold'
                      : 'text-gray-900'
                  }`}
                >
                  {cell.value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ========== Python Preview ==========

function PythonPreviewComponent({ preview }: { preview: PythonPreview }) {
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
        </div>
        <span className="text-gray-400 text-xs ml-2">{preview.fileName}</span>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm font-mono">
          {preview.lines.map((line) => (
            <div
              key={line.lineNumber}
              className={`flex ${
                line.isHighlighted ? 'bg-yellow-500/20 -mx-4 px-4' : ''
              }`}
            >
              <span className="w-8 text-gray-500 select-none text-right mr-4">
                {line.lineNumber}
              </span>
              <span className={line.isHighlighted ? 'text-yellow-300' : 'text-gray-300'}>
                {highlightPythonSyntax(line.content)}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function highlightPythonSyntax(code: string): React.ReactNode {
  // Simple syntax highlighting
  const keywords = ['def', 'return', 'import', 'from', 'class', 'if', 'else', 'for', 'while', 'try', 'except'];
  const parts: React.ReactNode[] = [];

  // Handle comments
  if (code.trim().startsWith('#')) {
    return <span className="text-gray-500 italic">{code}</span>;
  }

  // Handle strings
  if (code.includes('"""') || code.includes("'''")) {
    return <span className="text-green-400">{code}</span>;
  }

  // Simple keyword highlighting
  let remaining = code;
  let key = 0;

  keywords.forEach((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, 'g');
    remaining = remaining.replace(regex, `__KW_${kw}__`);
  });

  const tokens = remaining.split(/(__KW_\w+__)/);
  tokens.forEach((token, i) => {
    const kwMatch = token.match(/__KW_(\w+)__/);
    if (kwMatch) {
      parts.push(
        <span key={key++} className="text-purple-400">
          {kwMatch[1]}
        </span>
      );
    } else {
      // Highlight function calls
      const funcHighlighted = token.replace(
        /(\w+)\(/g,
        (_, fn) => `__FUNC_${fn}__(`
      );
      const funcTokens = funcHighlighted.split(/(__FUNC_\w+__)/);
      funcTokens.forEach((ft) => {
        const funcMatch = ft.match(/__FUNC_(\w+)__/);
        if (funcMatch) {
          parts.push(
            <span key={key++} className="text-blue-400">
              {funcMatch[1]}
            </span>
          );
        } else {
          parts.push(<span key={key++}>{ft}</span>);
        }
      });
    }
  });

  return <>{parts}</>;
}

// ========== Word Preview ==========

function WordPreviewComponent({ preview }: { preview: WordPreview }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-inner">
      {/* Document header bar */}
      <div className="h-2 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-lg"></div>
      <div className="p-6 space-y-4">
        {preview.paragraphs.map((para, i) => {
          if (i === 0) {
            // Title
            return (
              <h3 key={i} className="text-lg font-bold text-gray-900 border-b pb-2">
                {para.text}
              </h3>
            );
          }

          if (para.highlightedText) {
            // Paragraph with highlighted text
            const parts = para.text.split(para.highlightedText);
            return (
              <p key={i} className="text-gray-700 leading-relaxed">
                {parts[0]}
                <mark className="bg-yellow-200 px-1 rounded">{para.highlightedText}</mark>
                {parts[1]}
              </p>
            );
          }

          // Regular paragraph
          return (
            <p key={i} className="text-gray-700 leading-relaxed">
              {para.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
