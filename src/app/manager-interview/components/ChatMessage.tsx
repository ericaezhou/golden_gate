import { ConversationMessage, MANAGER } from '../mockData'

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
            ? 'bg-gradient-to-br from-purple-500 to-blue-600 text-white'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
          }
        `}
      >
        {isAI ? 'AI' : MANAGER.initials}
      </div>

      {/* Message Bubble */}
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-3
          ${isAI
            ? 'bg-white border border-gray-200 text-gray-800'
            : 'bg-blue-600 text-white'
          }
        `}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  )
}

interface TypingIndicatorProps {
  isAI?: boolean
}

export function TypingIndicator({ isAI = true }: TypingIndicatorProps) {
  return (
    <div className={`flex gap-3 ${isAI ? '' : 'flex-row-reverse'}`}>
      <div
        className={`
          w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium
          ${isAI
            ? 'bg-gradient-to-br from-purple-500 to-blue-600 text-white'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
          }
        `}
      >
        {isAI ? 'AI' : 'DP'}
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
