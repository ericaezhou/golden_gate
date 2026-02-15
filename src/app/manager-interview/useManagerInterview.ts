import { useState, useCallback, useEffect } from 'react'
import { ConversationMessage } from './mockData'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface InterviewState {
  messages: ConversationMessage[]
  inputValue: string
  isAITyping: boolean
  isComplete: boolean
  priorities: string[]       // reused as "extracted facts" from interview
  questionsRemaining: number
  round: number
  error: string | null
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Hook that drives the real backend interview loop.
 *
 * Lifecycle:
 *  1. On mount, poll GET /api/interview/{sessionId}/status until interview_active
 *  2. Display the AI's rephrased question as a chat bubble
 *  3. User types an answer and hits Send
 *  4. POST /api/interview/{sessionId}/respond  →  get next question or completion
 *  5. Repeat until interview_active === false
 */
export function useManagerInterview(sessionId: string | null) {
  const [state, setState] = useState<InterviewState>({
    messages: [],
    inputValue: '',
    isAITyping: false,
    isComplete: false,
    priorities: [],
    questionsRemaining: 0,
    round: 0,
    error: null,
  })

  // ── Bootstrap: fetch the first question ──────────────────────────
  useEffect(() => {
    if (!sessionId) return

    let cancelled = false

    async function fetchFirstQuestion() {
      setState(prev => ({ ...prev, isAITyping: true }))

      // Poll until interview is active (pipeline might still be transitioning)
      let question: { question_text?: string; source_file?: string; raw_question?: string; remaining?: number; round?: number } | null = null
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          const res = await fetch(`${API_BASE}/api/interview/${sessionId}/status`)
          if (!res.ok) {
            await new Promise(r => setTimeout(r, 2000))
            continue
          }
          const data = await res.json()
          if (data.interview_active && data.question) {
            question = data.question
            break
          }
        } catch {
          // Network error — retry
        }
        await new Promise(r => setTimeout(r, 2000))
      }

      if (cancelled) return

      if (!question) {
        setState(prev => ({
          ...prev,
          isAITyping: false,
          error: 'Could not connect to interview. The pipeline may still be running.',
        }))
        return
      }

      const aiMessage: ConversationMessage = {
        id: generateMessageId(),
        role: 'ai',
        content: question.question_text || '(Ready for your response)',
        timestamp: Date.now(),
        sourceFile: question.source_file || undefined,
        rawQuestion: question.raw_question || undefined,
      }

      setState(prev => ({
        ...prev,
        messages: [aiMessage],
        isAITyping: false,
        questionsRemaining: question!.remaining ?? 0,
        round: question!.round ?? 1,
      }))
    }

    fetchFirstQuestion()
    return () => { cancelled = true }
  }, [sessionId])

  // ── Send the user's answer ───────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!state.inputValue.trim() || state.isAITyping || !sessionId) return

    const userText = state.inputValue.trim()

    // Add user message to chat
    const userMessage: ConversationMessage = {
      id: generateMessageId(),
      role: 'manager',     // reusing 'manager' role for the departing employee's answers
      content: userText,
      timestamp: Date.now(),
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      inputValue: '',
      isAITyping: true,
      error: null,
    }))

    try {
      const res = await fetch(`${API_BASE}/api/interview/${sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_response: userText }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(errData.detail || `Server returned ${res.status}`)
      }

      const data = await res.json()

      // Use all_facts (cumulative) for the sidebar — more reliable than incremental
      const allFacts: string[] = data.all_facts || data.facts_extracted || []

      if (data.interview_active && data.question) {
        // Next question
        const aiMessage: ConversationMessage = {
          id: generateMessageId(),
          role: 'ai',
          content: data.question.question_text || '(Ready for your response)',
          timestamp: Date.now(),
          sourceFile: data.question.source_file || undefined,
          rawQuestion: data.question.raw_question || undefined,
        }

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, aiMessage],
          isAITyping: false,
          priorities: allFacts,
          questionsRemaining: data.question.remaining ?? prev.questionsRemaining - 1,
          round: data.question.round ?? prev.round + 1,
        }))
      } else {
        // Interview complete
        setState(prev => ({
          ...prev,
          isAITyping: false,
          isComplete: true,
          priorities: allFacts.length > 0 ? allFacts : prev.priorities,
        }))
      }
    } catch (e) {
      setState(prev => ({
        ...prev,
        isAITyping: false,
        error: e instanceof Error ? e.message : 'Failed to send response',
      }))
    }
  }, [state.inputValue, state.isAITyping, sessionId])

  // ── End interview early ──────────────────────────────────────────
  const endInterview = useCallback(async () => {
    if (!sessionId) return

    setState(prev => ({ ...prev, isAITyping: true }))

    try {
      const res = await fetch(`${API_BASE}/api/interview/${sessionId}/end`, {
        method: 'POST',
      })
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }

      setState(prev => ({
        ...prev,
        isAITyping: false,
        isComplete: true,
      }))
    } catch (e) {
      setState(prev => ({
        ...prev,
        isAITyping: false,
        error: e instanceof Error ? e.message : 'Failed to end interview',
      }))
    }
  }, [sessionId])

  // ── Update input value ───────────────────────────────────────────
  const setInputValue = useCallback((value: string) => {
    setState(prev => ({ ...prev, inputValue: value }))
  }, [])

  // ── Keyboard: Enter to send ──────────────────────────────────────
  const handleKeyPress = useCallback(() => {
    // No-op: in live mode, the user types freely. handleKeyDown in ChatInput handles Enter.
  }, [])

  // ── Navigate to next page ────────────────────────────────────────
  const proceedToEmployeeInterview = useCallback(() => {
    window.location.href = `/handoff?session=${sessionId}`
  }, [sessionId])

  return {
    ...state,
    handleKeyPress,
    setInputValue,
    sendMessage,
    endInterview,
    proceedToEmployeeInterview,
  }
}
