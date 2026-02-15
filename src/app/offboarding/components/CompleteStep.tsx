'use client'

import { useRouter } from 'next/navigation'
import { useOffboarding } from '@/context/OffboardingContext'
import { addOffboardedEmployee } from '@/lib/offboarding-registry'
import { useEffect, useRef } from 'react'

export function CompleteStep() {
  const router = useRouter()
  const { sessionId, employeeName, roleTitle, projectName } = useOffboarding()
  const savedRef = useRef(false)

  // Save to registry on mount
  useEffect(() => {
    if (savedRef.current || !sessionId) return
    savedRef.current = true
    addOffboardedEmployee({
      sessionId,
      employeeName: employeeName || 'Unknown Employee',
      roleTitle: roleTitle || 'Unknown Role',
      projectName: projectName || 'Unknown Project',
      completedAt: new Date().toISOString(),
      status: 'completed',
    })
  }, [sessionId, employeeName, roleTitle, projectName])

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-lg text-center animate-fadeIn">
        {/* Success icon */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
          <div className="relative w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/20">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gg-text mb-4">
          Offboarding Complete
        </h1>

        <p className="text-gg-secondary text-lg mb-8 leading-relaxed">
          {employeeName ? `${employeeName}'s` : 'The employee\'s'} knowledge has been captured, documented, and an AI agent has been created for the team.
        </p>

        {/* Stats */}
        <div className="flex justify-center gap-4 mb-10">
          <div className="bg-gg-card border border-gg-border rounded-gg px-6 py-4">
            <div className="text-2xl font-bold text-gg-accent">5</div>
            <div className="text-xs text-gg-muted">Docs Enhanced</div>
          </div>
          <div className="bg-gg-card border border-gg-border rounded-gg px-6 py-4">
            <div className="text-2xl font-bold text-gg-accent-light">1</div>
            <div className="text-xs text-gg-muted">AI Agent Created</div>
          </div>
          <div className="bg-gg-card border border-gg-border rounded-gg px-6 py-4">
            <div className="text-2xl font-bold text-green-400">6</div>
            <div className="text-xs text-gg-muted">Knowledge Areas</div>
          </div>
        </div>

        {/* Summary card */}
        <div className="bg-gg-card border border-gg-border rounded-gg p-6 mb-8 text-left">
          <h3 className="font-semibold text-gg-text mb-3">Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gg-muted">Employee</span>
              <span className="text-gg-text">{employeeName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gg-muted">Role</span>
              <span className="text-gg-text">{roleTitle || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gg-muted">Project</span>
              <span className="text-gg-text">{projectName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gg-muted">Session</span>
              <span className="text-gg-secondary font-mono text-xs">{sessionId || '—'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push('/')}
          className="px-8 py-3 bg-gg-accent text-white font-semibold rounded-lg
                     hover:bg-gg-accent/90 transition-colors shadow-gg-glow
                     focus:outline-none focus:ring-2 focus:ring-gg-accent focus:ring-offset-2 focus:ring-offset-gg-bg"
        >
          Return Home
        </button>
      </div>
    </div>
  )
}
