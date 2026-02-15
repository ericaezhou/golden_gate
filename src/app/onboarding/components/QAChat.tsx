'use client'

import { useState, useRef, useEffect } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
}

const SUGGESTED_QUESTIONS = [
  'When should I apply an overlay?',
  'How do approvals work?',
  "Who's the backup contact?",
  'What are the segment thresholds?',
]

// Fallback responses when API isn't available
const FALLBACK_RESPONSES: Record<string, string> = {
  default: "I'm the knowledge agent for this role. I can answer questions about processes, decision criteria, and workflows captured during offboarding. What would you like to know?",
  overlay: 'Apply overlays when: 30-day delinquency rate increases >15% MoM, cohort variance exceeds 25% for 2+ months, or model staleness >30 days. The formula is 1% loss forecast per 10% delinquency increase, capped at 5%.',
  approval: 'Under $2M: Analyst discretion with documentation. $2M-$5M: CFO email approval. Over $5M: Full process — prepare memo, present at weekly Risk Committee sync, then CFO formal approval. Timeline: 3-5 business days.',
  backup: 'Primary backup: Marcus Thompson (Risk Analytics, ext. 4589). He knows the model but needs training on overlay decisions. For urgent matters, escalate to CFO directly.',
  threshold: 'Segment thresholds: Prime 3%, Near-prime 7%, Subprime 18%, Deep subprime 28%. These are dynamic — recalculate quarterly, especially after marketing campaigns or market events.',
}

function getFallbackResponse(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('overlay') || msg.includes('adjust') || msg.includes('when')) return FALLBACK_RESPONSES.overlay
  if (msg.includes('approval') || msg.includes('process') || msg.includes('cfo')) return FALLBACK_RESPONSES.approval
  if (msg.includes('backup') || msg.includes('contact') || msg.includes('who')) return FALLBACK_RESPONSES.backup
  if (msg.includes('threshold') || msg.includes('segment')) return FALLBACK_RESPONSES.threshold
  return FALLBACK_RESPONSES.default
}

export function QAChat({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'initial',
      role: 'agent',
      content: "Hello! I'm the knowledge agent for this role. Ask me anything about the captured processes, decisions, and workflows.",
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    }
    setMessages(prev => [...prev, userMsg])
    const userInput = input.trim()
    setInput('')
    setIsTyping(true)

    try {
      const res = await fetch(`${API_BASE}/api/onboarding/${sessionId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userInput }),
      })

      let responseText: string
      if (res.ok) {
        const data = await res.json()
        responseText = data.answer || data.response || data.content || JSON.stringify(data)
      } else {
        responseText = getFallbackResponse(userInput)
      }

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: responseText,
      }
      setMessages(prev => [...prev, agentMsg])
    } catch {
      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: getFallbackResponse(userInput),
      }
      setMessages(prev => [...prev, agentMsg])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gg-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gg-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <h2 className="text-sm font-semibold text-gg-text uppercase tracking-wider">QA Agent</h2>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-gg-muted">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-gg-accent text-white'
                  : 'bg-gg-surface border border-gg-border text-gg-text'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gg-surface border border-gg-border rounded-xl px-3 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions */}
      <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-gg-border/50 flex-shrink-0">
        {SUGGESTED_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => setInput(q)}
            className="px-2.5 py-1 text-xs bg-gg-surface border border-gg-border text-gg-secondary rounded-full
                       hover:bg-gg-card hover:text-gg-text transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gg-border flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            placeholder="Ask a question..."
            className="flex-1 px-3 py-2 bg-gg-surface border border-gg-border rounded-lg text-sm text-gg-text
                       placeholder-gg-muted focus:outline-none focus:ring-2 focus:ring-gg-accent focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="px-3 py-2 bg-gg-accent text-white rounded-lg hover:bg-gg-accent/90
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
