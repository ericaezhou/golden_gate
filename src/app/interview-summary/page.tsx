'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface InterviewSummaryData {
  session_id: string
  interview_summary: string
  extracted_facts: string[]
  error?: string
}

function InterviewSummaryContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')
  const [data, setData] = useState<InterviewSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function fetchSummary() {
      try {
        const res = await fetch(`${API_BASE}/api/session/${sessionId}/interview-summary`)
        if (!res.ok) {
          setFetchError(`Failed to load: ${res.status}`)
          setLoading(false)
          return
        }
        const json = await res.json()
        if (!cancelled) {
          setData(json)
        }
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : 'Failed to load interview summary')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchSummary()
    return () => { cancelled = true }
  }, [sessionId])

  if (!sessionId) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-lg w-full text-center">
          <p className="text-gray-500 mb-4">No session specified.</p>
          <a href="/" className="text-amber-600 hover:text-amber-700 underline">
            Start from home
          </a>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-lg w-full text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-amber-200 border-t-amber-600 animate-spin" />
          <p className="text-gray-600">Loading interview summary...</p>
        </div>
      </main>
    )
  }

  if (fetchError || data?.error) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-lg w-full text-center">
          <p className="text-red-600 mb-4">{fetchError || data?.error}</p>
          <a href={`/manager-interview?session=${sessionId}`} className="text-amber-600 hover:text-amber-700 underline">
            Back to interview
          </a>
        </div>
      </main>
    )
  }

  const summary = data?.interview_summary ?? ''
  const facts = data?.extracted_facts ?? []
  const hasContent = summary.length > 0 || facts.length > 0

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-amber-600">Golden Gate</h1>
          <p className="text-gray-500 text-sm mt-1">Interview Summary & Extracted Knowledge</p>
        </div>

        {!hasContent ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 mb-4">
              No interview summary available yet for this session. It may still be generating.
            </p>
            <a
              href={`/manager-interview?session=${sessionId}`}
              className="text-amber-600 hover:text-amber-700 underline"
            >
              Back to interview
            </a>
          </div>
        ) : (
          <>
            {/* Interview Summary */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-100 bg-amber-50">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Interview Summary
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Synthesized from the knowledge-transfer conversation</p>
              </div>
              <div className="px-6 py-5">
                <div className="interview-summary-markdown text-gray-700 leading-relaxed">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h1>,
                      h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-lg font-semibold text-gray-900 mt-4 mb-2">{children}</h2>,
                      h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-base font-semibold text-gray-800 mt-3 mb-1">{children}</h3>,
                      p: ({ children }: { children?: React.ReactNode }) => <p className="mb-3">{children}</p>,
                      ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
                      ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
                      li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
                      strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                      blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="border-l-4 border-amber-300 pl-4 py-1 my-2 text-gray-600 italic">{children}</blockquote>,
                    }}
                  >
                    {summary || '(No summary generated)'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Extracted Facts */}
            {facts.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Extracted Facts ({facts.length})
                  </h2>
                </div>
                <ul className="px-6 py-5 space-y-2">
                  {facts.map((fact, i) => (
                    <li key={i} className="flex gap-3 text-gray-700">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Continue */}
            <div className="text-center">
              <a
                href={`/onboarding?session=${sessionId}`}
                className="inline-block px-8 py-3 bg-amber-600 text-white font-semibold rounded-lg
                           hover:bg-amber-700 transition-colors shadow-md
                           focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                View Onboarding Narrative →
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default function InterviewSummaryPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </main>
      }
    >
      <InterviewSummaryContent />
    </Suspense>
  )
}
