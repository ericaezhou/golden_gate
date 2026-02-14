import { KnowledgeGap } from '../mockData'

interface KnowledgeGapsProps {
  gaps: KnowledgeGap[]
}

const severityStyles = {
  low: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
    icon: 'text-yellow-500',
  },
  medium: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    icon: 'text-orange-500',
  },
  high: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    icon: 'text-red-500',
  },
}

export function KnowledgeGaps({ gaps }: KnowledgeGapsProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 h-fit">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Knowledge Gaps
        </h2>
        {gaps.length > 0 && (
          <span className="text-sm text-gray-500">
            {gaps.length} identified
          </span>
        )}
      </div>

      {gaps.length === 0 ? (
        <p className="text-sm text-gray-400 italic">
          No gaps identified yet...
        </p>
      ) : (
        <ul className="space-y-3">
          {gaps.map((gap, index) => {
            const styles = severityStyles[gap.severity]
            return (
              <li
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
                  {/* Warning icon */}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-800">
                        {gap.title}
                      </span>
                      <span
                        className={`
                          text-xs px-2 py-0.5 rounded-full font-medium
                          ${styles.badge}
                        `}
                      >
                        {gap.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {gap.description}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
