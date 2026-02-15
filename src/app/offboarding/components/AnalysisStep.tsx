'use client'

import { useOffboarding } from '@/context/OffboardingContext'
import { useScreeningProgressLive } from '@/hooks/useScreeningProgressLive'
import { KnowledgeGaps } from '@/app/screening/components/KnowledgeGaps'
import { Questions } from '@/app/screening/components/Questions'
import { ProgressSpinner } from '@/app/screening/components/ProgressSpinner'
import { FileIcon, getFileExt } from '@/app/components/FileIcon'

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
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500
                  ${isComplete
                    ? 'bg-green-500/20 text-green-400'
                    : isCurrent
                      ? 'bg-gg-accent text-white animate-pulse'
                      : 'bg-gg-card text-gg-muted border border-gg-border'
                  }`}
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
                  isComplete ? 'text-green-400 font-medium' : isCurrent ? 'text-gg-accent-light font-medium' : 'text-gg-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 flex items-start pt-4 px-2">
                <div
                  className={`h-0.5 w-full transition-colors duration-500 ${
                    completedSteps.has(step.id) ? 'bg-green-500/30' : 'bg-gg-border'
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

export function AnalysisStep() {
  const { sessionId, setStep } = useOffboarding()
  const progress = useScreeningProgressLive(sessionId || '')

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gg-text">Knowledge Transfer Analysis</h1>
          <p className="text-gg-secondary text-sm mt-1">Analyzing uploaded artifacts</p>
        </div>

        <div className="mb-8">
          <ProgressStepper completedSteps={progress.completedTaskIds} currentStep={progress.currentTaskId} />
        </div>

        {progress.error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
            {progress.error}
          </div>
        )}

        <div className="bg-gg-card border border-gg-border rounded-gg p-8 mb-6">
          <ProgressSpinner
            currentActivity={progress.currentActivity}
            currentFile={progress.currentFile}
            isComplete={progress.isComplete}
          />

          {/* File list */}
          {progress.parsedFiles && progress.parsedFiles.length > 0 && (
            <div className="mt-4 border-t border-gg-border pt-4">
              <p className="text-xs font-medium text-gg-muted mb-2">Files</p>
              <div className="flex flex-wrap gap-2">
                {progress.parsedFiles.map((f) => {
                  const done = progress.deepDivedFiles?.includes(f)
                  const analyzing = !done && progress.currentFile === f
                  const ext = getFileExt(f)
                  return (
                    <span
                      key={f}
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors duration-500 ${
                        done
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : analyzing
                            ? 'bg-gg-accent/10 text-gg-accent-light border border-gg-accent/20'
                            : 'bg-gg-surface text-gg-secondary border border-gg-border'
                      }`}
                    >
                      <FileIcon ext={ext} />
                      <span className="truncate max-w-[140px]">{f}</span>
                      {analyzing && (
                        <svg className="w-3.5 h-3.5 text-gg-accent animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {done && (
                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Continue button */}
          {progress.isComplete && (
            <div className="mt-6 pt-6 border-t border-gg-border text-center">
              <button
                onClick={() => setStep(3)}
                className="px-8 py-3 bg-gg-accent text-white font-semibold rounded-lg
                           hover:bg-gg-accent/90 transition-colors shadow-gg-glow
                           focus:outline-none focus:ring-2 focus:ring-gg-accent focus:ring-offset-2 focus:ring-offset-gg-bg"
              >
                Continue to Employee Interview
              </button>
            </div>
          )}
        </div>

        {progress.discoveredGaps.length > 0 && (
          <div className="mb-6">
            <KnowledgeGaps gaps={progress.discoveredGaps} />
          </div>
        )}

        {progress.questions && progress.questions.length > 0 && (
          <div className="mb-6">
            <Questions questions={progress.questions} />
          </div>
        )}
      </div>
    </div>
  )
}
