'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { getOffboardedEmployee, OffboardedEmployee } from '@/lib/offboarding-registry'
import { OnboardingGraph } from './components/OnboardingGraph'
import { OnboardingSummary } from './components/OnboardingSummary'
import { QAChat } from './components/QAChat'

function OnboardingContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')
  const [employee, setEmployee] = useState<OffboardedEmployee | null>(null)

  useEffect(() => {
    if (sessionId) {
      const emp = getOffboardedEmployee(sessionId)
      setEmployee(emp || null)
    }
  }, [sessionId])

  if (!sessionId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gg-secondary mb-4">No session specified.</p>
          <a href="/" className="text-gg-accent hover:text-gg-accent-light underline">
            Return home
          </a>
        </div>
      </main>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gg-bg">
      {/* Header */}
      <header className="bg-gg-surface border-b border-gg-border px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gg-text">
              Onboarding: {employee?.roleTitle || 'Loading...'}
            </h1>
            <p className="text-sm text-gg-secondary">
              {employee?.employeeName ? `Knowledge from ${employee.employeeName}` : 'Loading...'}
              {employee?.projectName ? ` — ${employee.projectName}` : ''}
            </p>
          </div>
          <a
            href="/"
            className="px-4 py-2 text-sm text-gg-secondary hover:text-gg-text border border-gg-border rounded-lg
                       hover:bg-gg-card transition-colors"
          >
            &larr; Back to Home
          </a>
        </div>
      </header>

      {/* Main Content: Graph (60%) | Summary + QA (40%) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Graph */}
        <div className="flex-[3] border-r border-gg-border overflow-hidden">
          <OnboardingGraph sessionId={sessionId} />
        </div>

        {/* Right: Summary + QA stacked */}
        <div className="flex-[2] flex flex-col overflow-hidden">
          {/* Summary */}
          <div className="flex-1 border-b border-gg-border overflow-y-auto">
            <OnboardingSummary sessionId={sessionId} />
          </div>

          {/* QA Chat */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <QAChat sessionId={sessionId} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gg-secondary">Loading...</p>
      </main>
    }>
      <OnboardingContent />
    </Suspense>
  )
}
