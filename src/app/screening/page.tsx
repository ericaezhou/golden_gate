'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { KnowledgeGaps, Questions } from './components'
import { KnowledgeGap, QuestionItem } from './mockData'
import { useScreeningProgressLive } from './useScreeningProgressLive'
import { FileIcon, getFileExt } from '../components/FileIcon'

/* ------------------------------------------------------------------ */
/* Progress Stepper                                                    */
/* ------------------------------------------------------------------ */
const STEPS = [
  { id: 'parse_files', label: 'Parse Files' },
  { id: 'deep_dive', label: 'Deep Dive Analysis' },
  { id: 'identify_gaps', label: 'Identify Gaps' },
  { id: 'generate_questions', label: 'Generate Questions' },
]

function ProgressStepper({
  completedSteps,
  currentStep,
}: {
  completedSteps: Set<string>
  currentStep: string | null
}) {
  return (
    <div className="flex items-center justify-center w-full max-w-2xl mx-auto">
      {STEPS.map((step, i) => {
        const isComplete = completedSteps.has(step.id)
        const isCurrent = currentStep === step.id
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  transition-all duration-500
                  ${isComplete
                    ? 'bg-green-500 text-white'
                    : isCurrent
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-gray-200 text-gray-400'
                  }
                `}
              >
                {isComplete ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs mt-1.5 whitespace-nowrap ${
                  isComplete ? 'text-green-600 font-medium' : isCurrent ? 'text-amber-600 font-medium' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {/* Connector line — sits between circle and next circle, vertically centered with circles */}
            {i < STEPS.length - 1 && (
              <div className="flex-1 flex items-start pt-4 px-2">
                <div
                  className={`h-0.5 w-full transition-colors duration-500 ${
                    completedSteps.has(step.id) ? 'bg-green-400' : 'bg-gray-200'
                  }`}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main Layout                                                         */
/* ------------------------------------------------------------------ */
function ScreeningLayout({
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
      <div className="max-w-4xl mx-auto">
        {/* Branded Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-amber-600">
            Golden Gate
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Knowledge Transfer Analysis
          </p>
        </div>

        {/* Horizontal Progress Stepper */}
        <div className="mb-8">
          <ProgressStepper completedSteps={completedTaskIds} currentStep={currentTaskId} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* Main content card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          {/* Spinner + activity */}
          {!isComplete ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"
                  style={{ animationDuration: '1.5s' }}
                />
                <div className="absolute inset-3 rounded-full bg-amber-50 flex items-center justify-center">
                  <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
              <p className="text-lg font-medium text-gray-700">
                {currentActivity || 'Initializing...'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-20 h-20 mb-6 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium text-green-700">Analysis complete</p>
            </div>
          )}

          {/* File list */}
          {parsedFiles && parsedFiles.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Files</p>
              <div className="flex flex-wrap gap-2">
                {parsedFiles.map((f) => {
                  const done = deepDivedFiles?.includes(f)
                  const analyzing = !done && currentFile === f
                  const ext = getFileExt(f)
                  return (
                    <span
                      key={f}
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors duration-500 ${
                        done
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : analyzing
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-gray-50 text-gray-600 border border-gray-200'
                      }`}
                    >
                      <FileIcon ext={ext} />
                      <span className="truncate max-w-[140px]">{f}</span>
                      {analyzing && (
                        <svg className="w-3.5 h-3.5 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {done && (
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Continue to Interview button */}
          {isComplete && sessionId && (
            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <a
                href={`/manager-interview?session=${sessionId}`}
                className="inline-block px-8 py-3 bg-amber-600 text-white font-semibold rounded-lg
                           hover:bg-amber-700 transition-colors shadow-md
                           focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                Continue to Interview
              </a>
            </div>
          )}
        </div>

        {/* Results: Knowledge Gaps */}
        {discoveredGaps.length > 0 && (
          <div className="mb-6">
            <KnowledgeGaps gaps={discoveredGaps} />
          </div>
        )}

        {/* Results: Questions */}
        {questions && questions.length > 0 && (
          <div className="mb-6">
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
        <a href="/" className="text-amber-600 hover:text-amber-700 underline">
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
