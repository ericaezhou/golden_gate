'use client'

import { useState, useEffect } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Fallback narrative when API isn't available
const FALLBACK_NARRATIVE = `## Knowledge Transfer Summary

### Overview
This document captures the critical knowledge from the departing employee's role, covering decision frameworks, operational processes, and tribal knowledge that was previously undocumented.

### Key Decision Points
1. **Overlay triggers**: 15% MoM increase in 30-day delinquency, or 25% cohort variance for 2+ months
2. **Adjustment formula**: 1% loss forecast per 10% delinquency increase (capped at 5%)
3. **New product buffer**: 20% for products under 6 months old

### Approval Thresholds
- Under $2M impact: Analyst discretion with documentation
- $2M - $5M impact: CFO approval via email
- Over $5M impact: Memo + Risk Committee alignment + CFO formal approval (3-5 business days)

### Backup & Escalation
Primary backup: Marcus (Risk Analytics) — familiar with model but needs training on overlay decisions. For urgent matters during transition, escalate to CFO directly.

### Artifact Relationships
- **Q3_Loss_Forecast.xlsx**: Contains model predictions with overlay adjustments
- **loss_model.py**: Generates base loss predictions with overlay decision logic
- **Escalation_Policy.md**: Documents approval workflows and thresholds
- **threshold_config.py**: Defines segment thresholds and escalation rules`

export function OnboardingSummary({ sessionId }: { sessionId: string }) {
  const [narrative, setNarrative] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchNarrative() {
      try {
        const res = await fetch(`${API_BASE}/api/onboarding/${sessionId}/narrative`)
        if (res.ok) {
          const data = await res.json()
          setNarrative(data.narrative || data.content || JSON.stringify(data))
        } else {
          setNarrative(FALLBACK_NARRATIVE)
        }
      } catch {
        setNarrative(FALLBACK_NARRATIVE)
      } finally {
        setLoading(false)
      }
    }
    fetchNarrative()
  }, [sessionId])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-gg-accent border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm text-gg-muted">Loading summary...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-gg-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h2 className="text-sm font-semibold text-gg-text uppercase tracking-wider">Summary</h2>
      </div>
      <div className="prose prose-invert prose-sm max-w-none text-gg-secondary">
        {narrative?.split('\n').map((line, i) => {
          if (line.startsWith('## ')) {
            return <h2 key={i} className="text-lg font-bold text-gg-text mt-4 mb-2">{line.replace('## ', '')}</h2>
          }
          if (line.startsWith('### ')) {
            return <h3 key={i} className="text-sm font-semibold text-gg-accent-light mt-3 mb-1">{line.replace('### ', '')}</h3>
          }
          if (line.startsWith('- ')) {
            return (
              <div key={i} className="flex items-start gap-2 ml-2 mb-1">
                <span className="text-gg-accent mt-1 text-xs">&#x2022;</span>
                <span className="text-sm text-gg-secondary">{renderInlineMarkdown(line.replace('- ', ''))}</span>
              </div>
            )
          }
          if (line.match(/^\d+\./)) {
            return (
              <div key={i} className="flex items-start gap-2 ml-2 mb-1">
                <span className="text-gg-accent text-sm font-medium min-w-[20px]">{line.match(/^\d+/)![0]}.</span>
                <span className="text-sm text-gg-secondary">{renderInlineMarkdown(line.replace(/^\d+\.\s*/, ''))}</span>
              </div>
            )
          }
          if (line.trim() === '') return <div key={i} className="h-2" />
          return <p key={i} className="text-sm text-gg-secondary mb-1">{renderInlineMarkdown(line)}</p>
        })}
      </div>
    </div>
  )
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Handle **bold** text
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-gg-text font-medium">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}
