import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ConversationMessage,
  CONVERSATION_SCRIPT,
  TIMING,
  getNextExchange,
  isLastExchange,
} from './mockData'

export interface InterviewState {
  messages: ConversationMessage[]
  currentExchangeId: string | null
  inputValue: string
  isAITyping: boolean
  isComplete: boolean
  priorities: string[]
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

export function useManagerInterview() {
  const [state, setState] = useState<InterviewState>({
    messages: [],
    currentExchangeId: null,
    inputValue: '',
    isAITyping: false,
    isComplete: false,
    priorities: [],
  })

  const hasStartedRef = useRef(false)
  const charIndexRef = useRef(0)

  // Get current exchange
  const currentExchange = state.currentExchangeId
    ? CONVERSATION_SCRIPT.find(e => e.id === state.currentExchangeId)
    : null

  // Start the conversation with first AI message (only once)
  useEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    const firstExchange = CONVERSATION_SCRIPT[0]
    if (!firstExchange) return

    setState(prev => ({ ...prev, isAITyping: true }))

    setTimeout(() => {
      const aiMessage: ConversationMessage = {
        id: generateMessageId(),
        role: 'ai',
        content: firstExchange.aiMessage,
        timestamp: Date.now(),
      }

      setState(prev => ({
        ...prev,
        messages: [aiMessage],
        currentExchangeId: firstExchange.id,
        isAITyping: false,
      }))
    }, TIMING.initialDelayMs)
  }, [])

  // Handle each keypress - add one character from the scripted response
  const handleKeyPress = useCallback(() => {
    if (state.isAITyping || state.isComplete) return
    if (!currentExchange) return

    const targetText = currentExchange.managerResponse

    // If we've typed the full response, do nothing
    if (charIndexRef.current >= targetText.length) return

    // Add one more character
    charIndexRef.current++
    setState(prev => ({
      ...prev,
      inputValue: targetText.slice(0, charIndexRef.current),
    }))
  }, [state.isAITyping, state.isComplete, currentExchange])

  // Update input value (for direct edits, though not used in demo)
  const setInputValue = useCallback((value: string) => {
    setState(prev => ({ ...prev, inputValue: value }))
  }, [])

  // Send message
  const sendMessage = useCallback(() => {
    if (!state.inputValue.trim() || state.isAITyping || !currentExchange) return

    // Reset char index for next response
    charIndexRef.current = 0

    // Add manager's message
    const managerMessage: ConversationMessage = {
      id: generateMessageId(),
      role: 'manager',
      content: state.inputValue.trim(),
      timestamp: Date.now(),
    }

    // Extract priority from this exchange
    const newPriorities = currentExchange.priorityExtracted
      ? [...state.priorities, currentExchange.priorityExtracted]
      : state.priorities

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, managerMessage],
      inputValue: '',
      isAITyping: true,
      priorities: newPriorities,
    }))

    // Check if this was the last exchange
    if (isLastExchange(currentExchange.id)) {
      // Complete the interview
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          isAITyping: false,
          isComplete: true,
        }))
      }, TIMING.aiTypingIndicatorMs)
      return
    }

    // Get next exchange and send AI response
    const nextExchange = getNextExchange(currentExchange.id)
    if (!nextExchange) return

    setTimeout(() => {
      const aiMessage: ConversationMessage = {
        id: generateMessageId(),
        role: 'ai',
        content: nextExchange.aiMessage,
        timestamp: Date.now(),
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, aiMessage],
        currentExchangeId: nextExchange.id,
        isAITyping: false,
      }))
    }, TIMING.aiTypingIndicatorMs)
  }, [state.inputValue, state.isAITyping, state.priorities, currentExchange])

  // Proceed to employee interview
  const proceedToEmployeeInterview = useCallback(() => {
    window.location.href = '/conversation'
  }, [])

  return {
    ...state,
    currentExchange,
    handleKeyPress,
    setInputValue,
    sendMessage,
    proceedToEmployeeInterview,
  }
}
