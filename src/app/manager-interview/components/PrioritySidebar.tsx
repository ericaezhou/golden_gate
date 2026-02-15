interface PrioritySidebarProps {
  priorities: string[]
  isComplete: boolean
}

export function PrioritySidebar({ priorities, isComplete }: PrioritySidebarProps) {
  return (
    <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Knowledge Interview</h2>
        <p className="text-sm text-gray-500 mt-1">
          Capturing institutional knowledge before transition
        </p>
      </div>

      {/* Extracted Facts */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Extracted Facts
        </h3>

        {priorities.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            Facts will appear as you answer questions...
          </p>
        ) : (
          <ul className="space-y-2">
            {priorities.map((fact, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700 animate-fadeIn"
              >
                <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {isComplete && (
        <div className="p-6 border-t border-gray-200 bg-green-50">
          <div className="flex items-center gap-2 text-green-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-sm">Interview Complete</span>
          </div>
          <p className="text-xs text-green-600 mt-1">
            {priorities.length} facts captured
          </p>
        </div>
      )}
    </aside>
  )
}
