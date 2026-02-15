const extConfig: Record<string, { color: string; label: string }> = {
  xlsx: { color: 'bg-green-600', label: 'xlsx' },
  xls:  { color: 'bg-green-600', label: 'xls' },
  csv:  { color: 'bg-green-600', label: 'csv' },
  py:   { color: 'bg-blue-600', label: 'py' },
  ipynb:{ color: 'bg-orange-500', label: 'nb' },
  sql:  { color: 'bg-indigo-600', label: 'sql' },
  sqlite:{ color: 'bg-indigo-600', label: 'db' },
  db:   { color: 'bg-indigo-600', label: 'db' },
  pdf:  { color: 'bg-red-600', label: 'pdf' },
  pptx: { color: 'bg-orange-600', label: 'ppt' },
  ppt:  { color: 'bg-orange-600', label: 'ppt' },
  docx: { color: 'bg-blue-700', label: 'doc' },
  doc:  { color: 'bg-blue-700', label: 'doc' },
  txt:  { color: 'bg-gray-500', label: 'txt' },
}

export function FileIcon({ ext }: { ext: string }) {
  const config = extConfig[ext] || { color: 'bg-gray-400', label: ext.slice(0, 3) || '?' }
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${config.color} text-white text-[9px] font-bold leading-none flex-shrink-0`}>
      {config.label.toUpperCase().slice(0, 3)}
    </span>
  )
}

export function getFileExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() || ''
}
