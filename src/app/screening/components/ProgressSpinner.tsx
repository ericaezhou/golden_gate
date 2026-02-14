interface ProgressSpinnerProps {
  currentActivity: string | null
  currentFile: string | null
  isComplete: boolean
}

export function ProgressSpinner({
  currentActivity,
  currentFile,
  isComplete,
}: ProgressSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      {/* Spinning Circle */}
      <div className="relative w-32 h-32 mb-8">
        {isComplete ? (
          // Completed state
          <div className="w-full h-full rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-16 h-16 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : (
          // Spinning state
          <>
            <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
            <div
              className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"
              style={{ animationDuration: '1.5s' }}
            />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
          </>
        )}
      </div>

      {/* Current Activity */}
      <div className="text-center">
        {isComplete ? (
          <p className="text-lg font-medium text-green-700">
            Analysis complete
          </p>
        ) : (
          <>
            <p className="text-lg font-medium text-gray-700">
              {currentActivity || 'Initializing...'}
            </p>
            {currentFile && (
              <p className="mt-2 text-sm text-gray-400 font-mono">
                {currentFile}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
