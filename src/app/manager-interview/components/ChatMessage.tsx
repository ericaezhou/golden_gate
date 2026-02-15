import { ConversationMessage } from '../mockData'

interface ChatMessageProps {
  message: ConversationMessage
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAI = message.role === 'ai'

  return (
    <div
      className={`flex gap-3 ${isAI ? '' : 'flex-row-reverse'}`}
    >
      {/* Avatar */}
      <div
        className={`
          w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium
          ${isAI
            ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
          }
        `}
      >
        {isAI ? 'AI' : 'You'}
      </div>

      {/* Message Bubble */}
      <div className="max-w-[80%]">
        {/* Source file citation (AI messages only) */}
        {isAI && message.sourceFile && (
          <div className="flex items-center gap-1.5 mb-1.5 ml-1">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs text-gray-500 font-medium">
              from {message.sourceFile}
            </span>
          </div>
        )}

        <div
          className={`
            rounded-2xl px-4 py-3
            ${isAI
              ? 'bg-white border border-gray-200 text-gray-800'
              : 'bg-amber-600 text-white'
            }
          `}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>

        {/* Raw analytical question (collapsible, AI messages only) */}
        {isAI && message.rawQuestion && (
          <details className="mt-1.5 ml-1">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
              View original question
            </summary>
            <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600 italic">
              {message.rawQuestion}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium bg-gradient-to-br from-amber-500 to-orange-600 text-white">
        AI
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}
