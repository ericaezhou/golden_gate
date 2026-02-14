import { Task } from '../mockData'

interface TaskChecklistProps {
  tasks: Task[]
  completedTaskIds: Set<string>
  currentTaskId: string | null
}

export function TaskChecklist({
  tasks,
  completedTaskIds,
  currentTaskId,
}: TaskChecklistProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 h-fit">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Analysis Progress
      </h2>
      <ul className="space-y-3">
        {tasks.map((task) => {
          const isCompleted = completedTaskIds.has(task.id)
          const isCurrent = currentTaskId === task.id

          return (
            <li key={task.id} className="flex items-center gap-3">
              {/* Checkbox */}
              <div
                className={`
                  w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                  transition-colors duration-300
                  ${isCompleted
                    ? 'bg-green-500'
                    : isCurrent
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-gray-200'
                  }
                `}
              >
                {isCompleted && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {isCurrent && !isCompleted && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>

              {/* Label */}
              <span
                className={`
                  text-sm transition-colors duration-300
                  ${isCompleted
                    ? 'text-green-700 font-medium'
                    : isCurrent
                      ? 'text-blue-700 font-medium'
                      : 'text-gray-500'
                  }
                `}
              >
                {task.label}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
