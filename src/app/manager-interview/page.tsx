'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChatMessage, TypingIndicator, PrioritySidebar, FilePreviewModal } from './components'
import { useManagerInterview } from './useManagerInterview'

function InterviewContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  const {
    messages,
    inputValue,
    isAITyping,
    isComplete,
    priorities,
    questionsRemaining,
    round,
    error,
    setInputValue,
    sendMessage,
    endInterview,
    proceedToEmployeeInterview,
  } = useManagerInterview(sessionId)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // File preview modal state
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const handleFileClick = useCallback((fileName: string) => {
    setPreviewFile(fileName)
  }, [])
  const closePreview = useCallback(() => {
    setPreviewFile(null)
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAITyping])

  if (!sessionId) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No session found.</p>
          <a href="/" className="text-amber-600 hover:text-amber-700 underline">
            Start a new analysis
          </a>
        </div>
      </main>
    )
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Sidebar - Extracted Facts */}
      <PrioritySidebar priorities={priorities} isComplete={isComplete} />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-800">
                Knowledge Transfer Interview
              </h1>
              <p className="text-sm text-gray-500">
                {isComplete
                  ? 'Interview complete — onboarding deliverables are being generated'
                  : round > 0
                    ? `Round ${round} · ${questionsRemaining} questions remaining`
                    : 'Connecting to interview...'}
              </p>
            </div>
            <div className="flex gap-2">
              {!isComplete && round > 0 && (
                <button
                  onClick={endInterview}
                  disabled={isAITyping}
                  className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg
                             hover:bg-gray-300 transition-colors text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed
                             focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                  End Interview Early
                </button>
              )}
              {isComplete && (
                <button
                  onClick={proceedToEmployeeInterview}
                  className="px-4 py-2 bg-amber-600 text-white font-medium rounded-lg
                             hover:bg-amber-700 transition-colors text-sm
                             focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                >
                  View Onboarding Package →
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onFileClick={handleFileClick}
              />
            ))}

            {isAITyping && <TypingIndicator />}

            {isComplete && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-6 animate-fadeIn">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Interview Complete</p>
                    <p className="text-sm text-green-700 mt-1">
                      {priorities.length} facts extracted. Onboarding deliverables are being generated.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (inputValue.trim()) sendMessage()
                  }
                }}
                placeholder={isComplete ? 'Interview complete' : isAITyping ? 'Waiting for question...' : 'Type your answer...'}
                disabled={isAITyping || isComplete}
                rows={1}
                className="
                  w-full resize-none rounded-xl border border-gray-300 px-4 py-3
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                  disabled:bg-gray-50 disabled:text-gray-500
                  text-sm leading-relaxed
                "
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={isAITyping || isComplete || !inputValue.trim()}
              className={`
                px-4 py-3 rounded-xl font-medium text-sm
                transition-colors duration-150
                ${inputValue.trim() && !isAITyping && !isComplete
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              Send
            </button>
          </div>
        </div>
      </main>

      {/* File Preview Modal */}
      {previewFile && sessionId && (
        <FilePreviewModal
          sessionId={sessionId}
          fileName={previewFile}
          onClose={closePreview}
        />
      )}
    </div>
  )
}

export default function ManagerInterviewPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading interview...</p>
      </main>
    }>
      <InterviewContent />
    </Suspense>
  )
}
