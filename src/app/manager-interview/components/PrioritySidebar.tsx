import { DEPARTING_EMPLOYEE, MANAGER } from '../mockData'

interface PrioritySidebarProps {
  priorities: string[]
  isComplete: boolean
}

export function PrioritySidebar({ priorities, isComplete }: PrioritySidebarProps) {
  return (
    <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Manager Interview</h2>
        <p className="text-sm text-gray-500 mt-1">
          Understanding priorities for knowledge capture
        </p>
      </div>

      {/* People */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Participants
        </h3>

        {/* Manager */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-medium">
            {MANAGER.initials}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{MANAGER.name}</p>
            <p className="text-xs text-gray-500">{MANAGER.title}</p>
          </div>
        </div>

        {/* Departing Employee */}
        <div className="flex items-center gap-3 opacity-60">
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium text-sm">
            AC
          </div>
          <div>
            <p className="font-medium text-gray-700 text-sm">{DEPARTING_EMPLOYEE.name}</p>
            <p className="text-xs text-gray-500">Departing · {DEPARTING_EMPLOYEE.title}</p>
          </div>
        </div>
      </div>

      {/* Priorities Extracted */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Priorities Identified
        </h3>

        {priorities.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            Priorities will appear as the conversation progresses...
          </p>
        ) : (
          <ul className="space-y-2">
            {priorities.map((priority, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700 animate-fadeIn"
              >
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{priority}</span>
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
            {priorities.length} priorities captured
          </p>
        </div>
      )}
    </aside>
  )
}
