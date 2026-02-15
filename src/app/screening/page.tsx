'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { TaskChecklist, ProgressSpinner, KnowledgeGaps } from './components'
import { Task, KnowledgeGap } from './mockData'
import { useScreeningProgress } from './useScreeningProgress'
import { useScreeningProgressLive } from './useScreeningProgressLive'

/** Shared layout — renders whichever progress data is passed in. */
function ScreeningLayout({
  tasks,
  completedTaskIds,
  currentTaskId,
  currentActivity,
  currentFile,
  discoveredGaps,
  isComplete,
  error,
}: {
  tasks: Task[]
  completedTaskIds: Set<string>
  currentTaskId: string | null
  currentActivity: string | null
  currentFile: string | null
  discoveredGaps: KnowledgeGap[]
  isComplete: boolean
  error?: string | null
}) {
  const router = useRouter()

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

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        </div>

        {/* Knowledge Gaps - Full Width Below */}
        <div className="mt-6">
          <KnowledgeGaps gaps={discoveredGaps} />
        </div>
      </div>
    </main>
  )
}

/** Live mode — connected to real backend via SSE. */
function LiveScreening({ sessionId }: { sessionId: string }) {
  const progress = useScreeningProgressLive(sessionId)
  return <ScreeningLayout {...progress} />
}

/** Mock/demo mode — hardcoded data with timers. */
function MockScreening() {
  const progress = useScreeningProgress()
  return <ScreeningLayout {...progress} error={null} />
}

function ScreeningContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  if (sessionId) {
    return <LiveScreening sessionId={sessionId} />
  }
  return <MockScreening />
}

export default function ScreeningPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    }>
      <ScreeningContent />
    </Suspense>
  )
}
