'use client'

import { useState } from 'react'
import { KnowledgeGap } from '../mockData'

interface KnowledgeGapsProps {
  gaps: KnowledgeGap[]
}

type Severity = 'high' | 'medium' | 'low'

const severityStyles: Record<Severity, { bg: string; border: string; badge: string; icon: string }> = {
  high: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    icon: 'text-red-500',
  },
  medium: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    icon: 'text-orange-500',
  },
  low: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
    icon: 'text-yellow-500',
  },
}

const filterButtonStyles: Record<Severity, { active: string; inactive: string }> = {
  high: {
    active: 'bg-red-100 text-red-700 border-red-300',
    inactive: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  medium: {
    active: 'bg-orange-100 text-orange-700 border-orange-300',
    inactive: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  low: {
    active: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    inactive: 'bg-gray-100 text-gray-400 border-gray-200',
  },
}

export function KnowledgeGaps({ gaps }: KnowledgeGapsProps) {
  const [activeFilters, setActiveFilters] = useState<Set<Severity>>(
    new Set<Severity>(['high', 'medium', 'low'])
  )
  const [collapsed, setCollapsed] = useState(false)

  const toggleFilter = (severity: Severity) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(severity)) {
        next.delete(severity)
      } else {
        next.add(severity)
      }
      return next
    })
  }

  const severityOrder: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  const filteredGaps = gaps
    .filter((gap) => activeFilters.has(gap.severity))
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  const countBySeverity = (severity: Severity) =>
    gaps.filter((g) => g.severity === severity).length

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-800">
              Knowledge Gaps
            </h2>
          </button>
          {gaps.length > 0 && (
            <span className="text-sm text-gray-500">
              {filteredGaps.length} of {gaps.length} shown
            </span>
          )}
        </div>

        {/* Severity filters */}
        {gaps.length > 0 && !collapsed && (
          <div className="flex items-center gap-2">
            {(['high', 'medium', 'low'] as Severity[]).map((severity) => {
              const count = countBySeverity(severity)
              const isActive = activeFilters.has(severity)
              const styles = filterButtonStyles[severity]
              return (
                <button
                  key={severity}
                  onClick={() => toggleFilter(severity)}
                  className={`
                    px-3 py-1 text-xs font-medium rounded-full border
                    transition-all duration-200 cursor-pointer
                    ${isActive ? styles.active : styles.inactive}
                  `}
                >
                  {severity} ({count})
                </button>
              )
            })}
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {gaps.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              No gaps identified yet...
            </p>
          ) : filteredGaps.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              No gaps match the selected filters
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredGaps.map((gap, index) => {
                const styles = severityStyles[gap.severity]
                return (
                  <div
                    key={gap.id}
                    className={`
                      p-3 rounded-lg border transition-all duration-500
                      ${styles.bg} ${styles.border}
                      animate-fadeIn
                    `}
                    style={{
                      animationDelay: `${index * 100}ms`,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <svg
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.icon}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p className="text-sm text-gray-800 flex-1">
                            {gap.text}
                          </p>
                          <span
                            className={`
                              text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0
                              ${styles.badge}
                            `}
                          >
                            {gap.severity}
                          </span>
                        </div>
                        {gap.sourceFile && (
                          <span className="text-xs text-gray-400 mt-1 block">from {gap.sourceFile}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
