'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { TaskChecklist, ProgressSpinner, KnowledgeGaps, Questions } from './components'
import { Task, KnowledgeGap, QuestionItem } from './mockData'
import { useScreeningProgressLive } from './useScreeningProgressLive'

/** Shared layout — renders whichever progress data is passed in. */
function ScreeningLayout({
  tasks,
  completedTaskIds,
  currentTaskId,
  currentActivity,
  currentFile,
  discoveredGaps,
  questions,
  parsedFiles,
  deepDivedFiles,
  sessionId,
  isComplete,
  error,
}: {
  tasks: Task[]
  completedTaskIds: Set<string>
  currentTaskId: string | null
  currentActivity: string | null
  currentFile: string | null
  discoveredGaps: KnowledgeGap[]
  questions?: QuestionItem[]
  parsedFiles?: string[]
  deepDivedFiles?: string[]
  sessionId?: string
  isComplete: boolean
  error?: string | null
}) {
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

              {parsedFiles && parsedFiles.length > 0 && (
                <div className="mt-4 w-full">
                  <p className="text-xs font-medium text-gray-500 mb-2">Files analyzed</p>
                  <div className="flex flex-wrap gap-2">
                    {parsedFiles.map((f) => {
                      const done = deepDivedFiles?.includes(f)
                      return (
                        <span
                          key={f}
                          className={`text-xs px-2 py-1 rounded font-mono transition-colors duration-500 ${
                            done
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {f}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {isComplete && (
                <div className="mt-8 text-center">
                  <p className="text-gray-600 mb-4">Analysis complete</p>
                  {sessionId && (
                    <a href={`/manager-interview?session=${sessionId}`}
                       className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg
                                  hover:bg-blue-700 transition-colors
                                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                      Continue to Interview
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Knowledge Gaps - Full Width Below */}
        <div className="mt-6">
          <KnowledgeGaps gaps={discoveredGaps} />
        </div>

        {/* Questions Panel - shown after analysis */}
        {questions && questions.length > 0 && (
          <div className="mt-6">
            <Questions questions={questions} />
          </div>
        )}
      </div>
    </main>
  )
}

/** Live mode — connected to real backend via SSE. */
function LiveScreening({ sessionId }: { sessionId: string }) {
  const progress = useScreeningProgressLive(sessionId)
  return <ScreeningLayout {...progress} sessionId={sessionId} />
}

function ScreeningContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  if (sessionId) {
    return <LiveScreening sessionId={sessionId} />
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">No analysis session found.</p>
        <a href="/" className="text-blue-600 hover:text-blue-700 underline">
          Start a new analysis
        </a>
      </div>
    </main>
  )
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
