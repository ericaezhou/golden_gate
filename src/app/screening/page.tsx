'use client'

import { useRouter } from 'next/navigation'
import { TaskChecklist, ProgressSpinner, KnowledgeGaps } from './components'
import { useScreeningProgress } from './useScreeningProgress'

export default function ScreeningPage() {
  const router = useRouter()
  const {
    tasks,
    completedTaskIds,
    currentTaskId,
    currentActivity,
    currentFile,
    discoveredGaps,
    isComplete,
  } = useScreeningProgress()

  const handleProceedToInterview = () => {
    router.push('/manager-interview')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            Knowledge Transfer Analysis
          </h1>
          <p className="text-gray-500 mt-2">
            AI agent is analyzing employee artifacts and documentation
          </p>
        </div>

        {/* Main Content - Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Task Checklist */}
          <div className="lg:col-span-1">
            <TaskChecklist
              tasks={tasks}
              completedTaskIds={completedTaskIds}
              currentTaskId={currentTaskId}
            />
          </div>

          {/* Center Column - Progress Spinner */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center justify-center min-h-[400px]">
              <ProgressSpinner
                currentActivity={currentActivity}
                currentFile={currentFile}
                isComplete={isComplete}
              />

              {isComplete && (
                <div className="mt-8 text-center">
                  <p className="text-gray-600 mb-4">
                    Ready to proceed with knowledge gap resolution
                  </p>
                  <button
                    onClick={handleProceedToInterview}
                    className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg
                               hover:bg-blue-700 active:bg-blue-800
                               transition-colors duration-150
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Continue to Interview
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Knowledge Gaps */}
          <div className="lg:col-span-1">
            <KnowledgeGaps gaps={discoveredGaps} />
          </div>
        </div>
      </div>
    </main>
  )
}
