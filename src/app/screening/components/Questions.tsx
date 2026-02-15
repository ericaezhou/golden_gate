'use client'

import { useState } from 'react'
import { QuestionItem } from '../mockData'

interface QuestionsProps {
  questions: QuestionItem[]
}

const priorityMap: Record<string, { label: string; badge: string; order: number }> = {
  P0: { label: 'High', badge: 'bg-red-100 text-red-700', order: 0 },
  P1: { label: 'Medium', badge: 'bg-orange-100 text-orange-700', order: 1 },
  P2: { label: 'Low', badge: 'bg-yellow-100 text-yellow-700', order: 2 },
}

export function Questions({ questions }: QuestionsProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (questions.length === 0) return null

  const sorted = [...questions].sort((a, b) => {
    const aOrder = priorityMap[a.priority]?.order ?? 9
    const bOrder = priorityMap[b.priority]?.order ?? 9
    return aOrder - bOrder
  })

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
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
            Generated Questions
          </h2>
        </button>
        <span className="text-sm text-gray-500">
          {questions.length} questions
        </span>
      </div>

      {!collapsed && <div className="space-y-3">
        {sorted.map((q, index) => {
          const pm = priorityMap[q.priority] || priorityMap.P1
          return (
            <div
              key={q.id}
              className="p-3 rounded-lg border border-gray-200 bg-gray-50 animate-fadeIn"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{q.text}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${pm.badge}`}
                    >
                      {pm.label}
                    </span>
                    {q.sourceFile && (
                      <span className="text-xs text-gray-400">
                        from {q.sourceFile}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>}
    </div>
  )
}
