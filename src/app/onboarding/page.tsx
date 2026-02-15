'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface NarrativeData {
  session_id: string
  project_name?: string
  narrative_md: string
  cached: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Citation patterns from backend QA prompt: [Deep Dive: file_id], [Interview Summary], [Global Summary]
const CITATION_REGEX = /\[(Deep Dive: [^\]]+|Interview Summary|Global Summary)\]/g

function splitContentWithCitations(text: string): Array<{ type: 'text' | 'citation'; value: string }> {
  const segments: Array<{ type: 'text' | 'citation'; value: string }> = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  CITATION_REGEX.lastIndex = 0
  while ((m = CITATION_REGEX.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, m.index) })
    }
    segments.push({ type: 'citation', value: m[1] })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return segments.length ? segments : [{ type: 'text', value: text }]
}

function OnboardingContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')
  const [data, setData] = useState<NarrativeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [statusCode, setStatusCode] = useState<number | null>(null)

  // Chatbot: ask_question API
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const scrollToChatEnd = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  useEffect(() => {
    scrollToChatEnd()
  }, [chatMessages, scrollToChatEnd])

  const sendQuestion = useCallback(async () => {
    const q = chatInput.trim()
    if (!q || !sessionId || chatLoading) return
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: q }])
    setChatLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/${sessionId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const json = await res.json()
      const answer = res.ok ? (json.answer ?? '') : `Error: ${(json.detail ?? res.status).toString()}`
      setChatMessages((prev) => [...prev, { role: 'assistant', content: answer }])
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : 'Failed to get answer' },
      ])
    } finally {
      setChatLoading(false)
    }
  }, [sessionId, chatInput, chatLoading])

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function fetchNarrative() {
      try {
        const res = await fetch(`${API_BASE}/api/onboarding/${sessionId}/narrative`)
        setStatusCode(res.status)
        if (!res.ok) {
          const detail = (await res.json().catch(() => ({}))).detail ?? `Failed to load: ${res.status}`
          setFetchError(detail)
          setLoading(false)
          return
        }
        const json = await res.json()
        if (!cancelled) {
          setData(json)
        }
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : 'Failed to load onboarding narrative')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchNarrative()
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
          <p className="text-gray-600">Loading onboarding narrative...</p>
          <p className="text-sm text-gray-400 mt-2">This may take a moment if generated for the first time.</p>
        </div>
      </main>
    )
  }

  if (fetchError) {
    const is404 = statusCode === 404
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-lg w-full text-center">
          <p className="text-red-600 mb-4">{fetchError}</p>
          {is404 && (
            <p className="text-gray-500 text-sm mb-4">
              The onboarding package has not been generated yet. Complete the offboarding pipeline (handoff) first.
            </p>
          )}
          <div className="flex gap-4 justify-center flex-wrap">
            <a href={`/interview-summary?session=${sessionId}`} className="text-amber-600 hover:text-amber-700 underline">
              Back to Interview Summary
            </a>
            <a href="/" className="text-gray-500 hover:text-gray-700 underline">
              Home
            </a>
          </div>
        </div>
      </main>
    )
  }

  const narrativeMd = data?.narrative_md ?? ''
  const projectName = data?.project_name ?? ''

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-amber-600">Golden Gate</h1>
            <p className="text-gray-500 text-sm mt-1">Onboarding Narrative</p>
            {projectName && (
              <p className="text-gray-700 font-medium mt-2">{projectName}</p>
            )}
          </div>
          <Link
            href="/"
            className="shrink-0 px-4 py-2 text-sm font-semibold text-amber-600 hover:text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
          >
            Leave
          </Link>
        </div>

        {/* Narrative card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 bg-amber-50">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Your onboarding guide
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Generated from the previous owner&apos;s interview summary and deep dives
              {data?.cached && ' (cached)'}
            </p>
          </div>
          <div className="px-6 py-5">
            <div className="onboarding-narrative-markdown text-gray-700 leading-relaxed">
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
                {narrativeMd || '(No narrative content)'}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Chatbot: ask_question */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 bg-amber-50">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ask about this project
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Questions are answered from the previous owner&apos;s deep dives and interview summary
            </p>
          </div>
          <div className="flex flex-col min-h-[280px] max-h-[420px]">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {chatMessages.length === 0 && !chatLoading && (
                <p className="text-gray-400 text-sm">Ask anything about the project, files, or processes.</p>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-100 text-gray-800 border border-gray-200'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="text-sm prose prose-sm max-w-none">
                        {splitContentWithCitations(msg.content).map((seg, i) =>
                          seg.type === 'citation' ? (
                            <span
                              key={i}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 mr-1 mb-0.5 align-baseline"
                              title="Source"
                            >
                              {seg.value}
                            </span>
                          ) : (
                            <ReactMarkdown
                              key={i}
                              components={{
                                p: ({ children }: { children?: React.ReactNode }) => <p className="mb-1 last:mb-0">{children}</p>,
                                ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-4 my-1">{children}</ul>,
                                ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-4 my-1">{children}</ol>,
                                li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
                                strong: ({ children }: { children?: React.ReactNode }) => <strong>{children}</strong>,
                              }}
                            >
                              {seg.value}
                            </ReactMarkdown>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-500 rounded-lg px-4 py-2.5 text-sm">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse mr-2" />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-gray-100 p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendQuestion()
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your question..."
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2.5 bg-amber-600 text-white font-medium rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="text-center space-y-3">
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href={`/handoff?session=${sessionId}`}
              className="inline-block px-8 py-3 bg-amber-600 text-white font-semibold rounded-lg
                         hover:bg-amber-700 transition-colors shadow-md
                         focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              Continue to Handoff / Package →
            </a>
            <a
              href={`/graph?session=${sessionId}`}
              className="inline-block px-8 py-3 bg-white text-amber-600 font-semibold rounded-lg
                         border-2 border-amber-500 hover:bg-amber-50 transition-colors shadow-md
                         focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              View Knowledge Graph →
            </a>
          </div>
          <div className="flex gap-4 justify-center flex-wrap text-sm">
            <a href={`/interview-summary?session=${sessionId}`} className="text-gray-500 hover:text-gray-700 underline">
              Interview Summary
            </a>
            <a href={`/graph?session=${sessionId}`} className="text-gray-500 hover:text-gray-700 underline">
              Knowledge Graph
            </a>
            <a href="/" className="text-gray-500 hover:text-gray-700 underline">
              Home
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </main>
      }
    >
      <OnboardingContent />
    </Suspense>
  )
}
