'use client'

import { useState } from 'react'

interface PrioritySidebarProps {
  priorities: string[]
  isComplete: boolean
}

/** Max chars to show before truncating a fact */
const TRUNCATE_AT = 120
/** Show this many facts expanded by default */
const SHOW_EXPANDED = 5

export function PrioritySidebar({ priorities, isComplete }: PrioritySidebarProps) {
  const [expandedFacts, setExpandedFacts] = useState<Set<number>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const displayFacts = showAll ? priorities : priorities.slice(0, SHOW_EXPANDED)
  const hasMore = priorities.length > SHOW_EXPANDED

  const toggleFact = (idx: number) => {
    setExpandedFacts(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Extracted Facts
          </h3>
          {priorities.length > 0 && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {priorities.length}
            </span>
          )}
        </div>

        {priorities.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            Facts will appear as you answer questions...
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {displayFacts.map((fact, index) => {
                const isLong = fact.length > TRUNCATE_AT
                const isExpanded = expandedFacts.has(index)
                const displayText = isLong && !isExpanded
                  ? fact.slice(0, TRUNCATE_AT) + '...'
                  : fact

                return (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-gray-700 animate-fadeIn"
                  >
                    <span className="text-green-500 mt-0.5 flex-shrink-0 text-xs">&#10003;</span>
                    <div className="min-w-0">
                      <span className="text-xs leading-relaxed">{displayText}</span>
                      {isLong && (
                        <button
                          onClick={() => toggleFact(index)}
                          className="ml-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                        >
                          {isExpanded ? 'less' : 'more'}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            {/* Show more / less toggle */}
            {hasMore && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-3 w-full text-center text-xs text-amber-600 hover:text-amber-700 font-medium py-2 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
              >
                {showAll
                  ? 'Show fewer facts'
                  : `Show all ${priorities.length} facts (+${priorities.length - SHOW_EXPANDED} more)`
                }
              </button>
            )}
          </>
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
