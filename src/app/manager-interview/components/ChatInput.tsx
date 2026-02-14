import { useEffect, useRef } from 'react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onKeyPress: () => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onKeyPress,
  disabled = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    }
  }, [value])

  // Focus textarea on mount
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus()
    }
  }, [disabled])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim()) {
        onSend()
      }
      return
    }

    // For any printable character, trigger onKeyPress to add one scripted character
    if (!disabled && e.key.length === 1) {
      e.preventDefault()
      onKeyPress()
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="
              w-full resize-none rounded-xl border border-gray-300 px-4 py-3
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-50 disabled:text-gray-500
              text-sm leading-relaxed
            "
          />
        </div>

        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className={`
            px-4 py-3 rounded-xl font-medium text-sm
            transition-colors duration-150
            ${value.trim() && !disabled
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          Send
        </button>
      </div>
    </div>
  )
}
