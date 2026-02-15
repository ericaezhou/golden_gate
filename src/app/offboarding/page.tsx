'use client'

import { OffboardingProvider, useOffboarding, OffboardingStep } from '@/context/OffboardingContext'
import { UploadStep } from './components/UploadStep'
import { AnalysisStep } from './components/AnalysisStep'
import { EmployeeStep } from './components/EmployeeStep'
import { HandoffStep } from './components/HandoffStep'
import { CompleteStep } from './components/CompleteStep'

const STEPS: { id: OffboardingStep; label: string }[] = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Analysis' },
  { id: 3, label: 'Employee Interview' },
  { id: 4, label: 'Handoff' },
  { id: 5, label: 'Complete' },
]

function VerticalStepper({ currentStep }: { currentStep: OffboardingStep }) {
  return (
    <aside className="w-64 bg-gg-surface border-r border-gg-border flex flex-col py-8 px-6 flex-shrink-0">
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gg-rust">Offboarding</h2>
        <p className="text-xs text-gg-muted mt-1">Knowledge capture pipeline</p>
      </div>
      <nav className="flex-1">
        {STEPS.map((step, i) => {
          const isComplete = step.id < currentStep
          const isCurrent = step.id === currentStep
          return (
            <div key={step.id} className="flex items-start gap-3 mb-1">
              {/* Vertical line + circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                    isComplete
                      ? 'bg-green-500/20 text-green-400'
                      : isCurrent
                        ? 'bg-gg-rust text-white shadow-[0_0_12px_rgba(192,54,44,0.4)]'
                        : 'bg-gg-card text-gg-muted border border-gg-border'
                  }`}
                >
                  {isComplete ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-0.5 h-8 my-1 transition-colors ${
                      isComplete ? 'bg-green-500/30' : 'bg-gg-border'
                    }`}
                  />
                )}
              </div>
              {/* Label */}
              <div className="pt-1.5">
                <span
                  className={`text-sm font-medium ${
                    isComplete
                      ? 'text-green-400'
                      : isCurrent
                        ? 'text-gg-text'
                        : 'text-gg-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

function OffboardingContent() {
  const { step } = useOffboarding()

  return (
    <div className="h-screen flex bg-gg-bg">
      <VerticalStepper currentStep={step} />
      <main className="flex-1 overflow-hidden">
        {step === 1 && <UploadStep />}
        {step === 2 && <AnalysisStep />}
        {step === 3 && <EmployeeStep />}
        {step === 4 && <HandoffStep />}
        {step === 5 && <CompleteStep />}
      </main>
    </div>
  )
}

export default function OffboardingPage() {
  return (
    <OffboardingProvider>
      <OffboardingContent />
    </OffboardingProvider>
  )
}
