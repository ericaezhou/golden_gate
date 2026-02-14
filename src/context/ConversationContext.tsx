'use client';

import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import {
  ConversationPhase,
  ChatMessage,
  KnowledgeGap,
  GapCategory,
  Employee,
  SessionProgress,
} from '@/types/conversation';
import {
  MOCK_EMPLOYEE,
  MOCK_GAPS,
  GAP_CATEGORIES,
  calculateProgress,
} from '@/data/mockGaps';
import {
  generateWelcomeMessage,
  generateGapQuestionMessage,
  generateMockAIResponse,
  generateCategoryIntroMessage,
  getNextGap,
  getGapById,
} from '@/lib/conversationFlow';

// ========== State Types ==========

interface ConversationState {
  employee: Employee;
  phase: ConversationPhase;
  gaps: KnowledgeGap[];
  messages: ChatMessage[];
  currentGapId?: string;
  currentCategory?: GapCategory;
  progress: SessionProgress;
  isTyping: boolean;
  questionCountForCurrentGap: number;
}

type ConversationAction =
  | { type: 'SET_PHASE'; payload: ConversationPhase }
  | { type: 'SELECT_GAP'; payload: string }
  | { type: 'SELECT_CATEGORY'; payload: GapCategory }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_GAP'; payload: KnowledgeGap }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'INCREMENT_QUESTION_COUNT' }
  | { type: 'RESET_QUESTION_COUNT' };

// ========== Initial State ==========

const initialState: ConversationState = {
  employee: MOCK_EMPLOYEE,
  phase: 'overview',
  gaps: MOCK_GAPS,
  messages: [generateWelcomeMessage(MOCK_EMPLOYEE.name)],
  progress: calculateProgress(MOCK_GAPS),
  isTyping: false,
  questionCountForCurrentGap: 0,
};

// ========== Reducer ==========

function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.payload };

    case 'SELECT_GAP': {
      const gap = state.gaps.find((g) => g.id === action.payload);
      return {
        ...state,
        currentGapId: action.payload,
        currentCategory: gap?.category,
        questionCountForCurrentGap: 0,
      };
    }

    case 'SELECT_CATEGORY':
      return {
        ...state,
        currentCategory: action.payload,
        currentGapId: undefined,
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case 'UPDATE_GAP': {
      const newGaps = state.gaps.map((g) =>
        g.id === action.payload.id ? action.payload : g
      );
      return {
        ...state,
        gaps: newGaps,
        progress: calculateProgress(newGaps),
      };
    }

    case 'SET_TYPING':
      return { ...state, isTyping: action.payload };

    case 'INCREMENT_QUESTION_COUNT':
      return { ...state, questionCountForCurrentGap: state.questionCountForCurrentGap + 1 };

    case 'RESET_QUESTION_COUNT':
      return { ...state, questionCountForCurrentGap: 0 };

    default:
      return state;
  }
}

// ========== Context ==========

interface ConversationContextValue {
  state: ConversationState;
  selectGap: (gapId: string) => void;
  selectCategory: (category: GapCategory) => void;
  sendMessage: (content: string) => void;
  startConversation: () => void;
  currentGap: KnowledgeGap | undefined;
  categoryInfo: typeof GAP_CATEGORIES[GapCategory] | undefined;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

// ========== Provider ==========

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(conversationReducer, initialState);

  const currentGap = state.currentGapId ? getGapById(state.gaps, state.currentGapId) : undefined;
  const categoryInfo = state.currentCategory ? GAP_CATEGORIES[state.currentCategory] : undefined;

  const selectGap = useCallback((gapId: string) => {
    dispatch({ type: 'SELECT_GAP', payload: gapId });

    const gap = state.gaps.find((g) => g.id === gapId);
    if (gap) {
      dispatch({ type: 'SET_PHASE', payload: 'conversation' });

      // Add a message about the selected gap
      const gapMessage = generateGapQuestionMessage(gap);
      dispatch({ type: 'ADD_MESSAGE', payload: gapMessage });

      // Update gap status to in_progress
      if (gap.status === 'not_started') {
        dispatch({
          type: 'UPDATE_GAP',
          payload: { ...gap, status: 'in_progress', updatedAt: new Date().toISOString() },
        });
      }
    }
  }, [state.gaps]);

  const selectCategory = useCallback((category: GapCategory) => {
    const isAlreadySelected = state.currentCategory === category;

    if (isAlreadySelected) {
      // Toggle off
      dispatch({ type: 'SELECT_CATEGORY', payload: category });
      return;
    }

    dispatch({ type: 'SELECT_CATEGORY', payload: category });
    dispatch({ type: 'SET_PHASE', payload: 'gap_selection' });

    // Add category intro message
    const categoryGaps = state.gaps.filter((g) => g.category === category);
    const introMessage = generateCategoryIntroMessage(category, categoryGaps);
    dispatch({ type: 'ADD_MESSAGE', payload: introMessage });

    // Auto-select the first incomplete gap in this category
    const nextGap = getNextGap(categoryGaps);
    if (nextGap) {
      setTimeout(() => {
        selectGap(nextGap.id);
      }, 500);
    }
  }, [state.currentCategory, state.gaps, selectGap]);

  const sendMessage = useCallback((content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      relatedGapIds: state.currentGapId ? [state.currentGapId] : undefined,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });

    // Show typing indicator
    dispatch({ type: 'SET_TYPING', payload: true });

    // Simulate AI response delay
    setTimeout(() => {
      dispatch({ type: 'SET_TYPING', payload: false });

      const currentGapForResponse = state.currentGapId
        ? state.gaps.find((g) => g.id === state.currentGapId)
        : null;

      // Check if user wants to move to next or mark as done
      const lowerContent = content.toLowerCase();
      const wantsNext = lowerContent.includes('next') || lowerContent.includes('move on');
      const wantsDone = lowerContent.includes('done') || lowerContent.includes("that's all");

      if (currentGapForResponse) {
        if (wantsDone || state.questionCountForCurrentGap >= 2) {
          // Mark current gap as captured
          dispatch({
            type: 'UPDATE_GAP',
            payload: {
              ...currentGapForResponse,
              status: 'captured',
              capturedKnowledge: {
                summary: `Knowledge captured from conversation about ${currentGapForResponse.title}`,
                details: content,
                relatedMessageIds: [userMessage.id],
                capturedAt: new Date().toISOString(),
              },
              updatedAt: new Date().toISOString(),
            },
          });

          // Find next gap
          const nextGap = getNextGap(
            state.gaps.filter((g) => g.id !== currentGapForResponse.id),
            state.currentCategory
          );

          if (nextGap) {
            const transitionMessage: ChatMessage = {
              id: `msg-transition-${Date.now()}`,
              role: 'assistant',
              content: `Great! I've captured that information about **${currentGapForResponse.title}**.\n\nLet's move on to the next topic.`,
              timestamp: new Date().toISOString(),
            };
            dispatch({ type: 'ADD_MESSAGE', payload: transitionMessage });

            setTimeout(() => {
              selectGap(nextGap.id);
            }, 1000);
          } else {
            const completionMessage: ChatMessage = {
              id: `msg-complete-${Date.now()}`,
              role: 'assistant',
              content: `Excellent! We've captured all the knowledge gaps${state.currentCategory ? ` in ${GAP_CATEGORIES[state.currentCategory].label}` : ''}.\n\n**Summary:** ${state.progress.capturedGaps + 1} of ${state.progress.totalGaps} gaps captured.\n\nWould you like to review what we've captured or continue with another category?`,
              timestamp: new Date().toISOString(),
              metadata: { isSummary: true },
            };
            dispatch({ type: 'ADD_MESSAGE', payload: completionMessage });
            dispatch({ type: 'SET_PHASE', payload: 'review' });
          }
        } else if (wantsNext) {
          // Skip to next gap without marking current as complete
          const nextGap = getNextGap(
            state.gaps.filter((g) => g.id !== currentGapForResponse.id),
            state.currentCategory
          );

          if (nextGap) {
            const skipMessage: ChatMessage = {
              id: `msg-skip-${Date.now()}`,
              role: 'assistant',
              content: "No problem, let's move on.",
              timestamp: new Date().toISOString(),
            };
            dispatch({ type: 'ADD_MESSAGE', payload: skipMessage });

            setTimeout(() => {
              selectGap(nextGap.id);
            }, 500);
          }
        } else {
          // Generate follow-up response
          const aiResponse = generateMockAIResponse(
            content,
            currentGapForResponse,
            state.questionCountForCurrentGap
          );
          dispatch({ type: 'ADD_MESSAGE', payload: aiResponse });
          dispatch({ type: 'INCREMENT_QUESTION_COUNT' });
        }
      } else {
        // No current gap, general response
        const aiResponse: ChatMessage = {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content: "I'm ready to help capture your knowledge. Please select a category from the sidebar to begin, or I can guide you through the most critical gaps first.",
          timestamp: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_MESSAGE', payload: aiResponse });
      }
    }, 1000 + Math.random() * 500);
  }, [state.currentGapId, state.gaps, state.currentCategory, state.questionCountForCurrentGap, state.progress, selectGap]);

  const startConversation = useCallback(() => {
    // Find the first critical gap or highest priority gap
    const nextGap = getNextGap(state.gaps);
    if (nextGap) {
      selectCategory(nextGap.category);
    }
  }, [state.gaps, selectCategory]);

  const value: ConversationContextValue = {
    state,
    selectGap,
    selectCategory,
    sendMessage,
    startConversation,
    currentGap,
    categoryInfo,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

// ========== Hook ==========

export function useConversation() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}
