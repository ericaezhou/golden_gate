'use client'

import { useEffect, useRef } from 'react'
import { ChatMessage, TypingIndicator, ChatInput, PrioritySidebar } from './components'
import { useManagerInterview } from './useManagerInterview'

export default function ManagerInterviewPage() {
  const {
    messages,
    inputValue,
    isAITyping,
    isComplete,
    priorities,
    handleKeyPress,
    setInputValue,
    sendMessage,
    proceedToEmployeeInterview,
  } = useManagerInterview()

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAITyping])

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Sidebar - Priorities */}
      <PrioritySidebar priorities={priorities} isComplete={isComplete} />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-800">
                Manager Priority Interview
              </h1>
              <p className="text-sm text-gray-500">
                Bridge AI is gathering context before the employee interview
              </p>
            </div>
            {isComplete && (
              <button
                onClick={proceedToEmployeeInterview}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg
                           hover:bg-blue-700 transition-colors text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Proceed to Employee Interview →
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
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
                      {priorities.length} priorities identified. Ready to proceed to the employee knowledge capture interview with Alice Chen.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={sendMessage}
          onKeyPress={handleKeyPress}
          disabled={isAITyping || isComplete}
          placeholder={isComplete ? 'Interview complete' : 'Type to respond...'}
        />
      </main>
    </div>
  )
}
