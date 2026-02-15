'use client'

import { useState } from 'react'
import { KnowledgeGap } from '../mockData'

interface KnowledgeGapsProps {
  gaps: KnowledgeGap[]
}

type Severity = 'high' | 'medium' | 'low'

const severityStyles: Record<Severity, { badge: string }> = {
  high: { badge: 'bg-red-500/10 text-red-400' },
  medium: { badge: 'bg-orange-500/10 text-orange-400' },
  low: { badge: 'bg-yellow-500/10 text-yellow-400' },
}

const severityLabels: Record<Severity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const filterButtonStyles: Record<Severity, { active: string; inactive: string }> = {
  high: {
    active: 'bg-red-500/10 text-red-400 border-red-500/30',
    inactive: 'bg-gg-surface text-gg-muted border-gg-border',
  },
  medium: {
    active: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    inactive: 'bg-gg-surface text-gg-muted border-gg-border',
  },
  low: {
    active: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    inactive: 'bg-gg-surface text-gg-muted border-gg-border',
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
    <div className="bg-gg-card border border-gg-border rounded-gg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <svg
              className={`w-4 h-4 text-gg-muted transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <h2 className="text-lg font-semibold text-gg-text">
              Knowledge Gaps
            </h2>
          </button>
          {gaps.length > 0 && (
            <span className="text-sm text-gg-muted">
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
                  {severityLabels[severity]} ({count})
                </button>
              )
            })}
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {gaps.length === 0 ? (
            <p className="text-sm text-gg-muted italic">
              No gaps identified yet...
            </p>
          ) : filteredGaps.length === 0 ? (
            <p className="text-sm text-gg-muted italic">
              No gaps match the selected filters
            </p>
          ) : (
            <div className="space-y-3">
              {filteredGaps.map((gap, index) => {
                const styles = severityStyles[gap.severity]
                return (
                  <div
                    key={gap.id}
                    className="p-3 rounded-lg border border-gg-border bg-gg-surface animate-fadeIn"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gg-text">{gap.text}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}
                          >
                            {severityLabels[gap.severity]}
                          </span>
                          {gap.sourceFile && (
                            <span className="text-xs text-gg-muted">
                              from {gap.sourceFile}
                            </span>
                          )}
                        </div>
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
