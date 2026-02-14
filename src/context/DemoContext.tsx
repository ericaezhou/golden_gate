'use client';

import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { DemoState, KnowledgeItem, ConversationMessage } from '@/types/demo';
import { ALICE_CHEN, SECTIONS, ITEMS, DEFAULT_KNOWLEDGE_CARD, getTotalProgress, getItemsBySection, getScriptedResponse } from '@/data/demoData';

// ========== Actions ==========

type DemoAction =
  | { type: 'SELECT_ITEM'; payload: { itemId: string; isReview?: boolean } }
  | { type: 'TOGGLE_SECTION'; payload: string }
  | { type: 'UPDATE_ITEM'; payload: KnowledgeItem }
  | { type: 'ADD_MESSAGE'; payload: ConversationMessage }
  | { type: 'SET_AWAITING_FOLLOW_UP'; payload: boolean }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'GENERATE_KNOWLEDGE_CARD' }
  | { type: 'RESET' };

// ========== Initial State ==========

const initialState: DemoState = {
  employee: ALICE_CHEN,
  sections: SECTIONS,
  items: ITEMS.map(item => ({ ...item })),
  currentItemId: null,
  expandedSectionId: SECTIONS[0]?.id || null,
  isAwaitingFollowUp: false,
  isTyping: false,
  knowledgeCard: null,
  conversationHistory: [],
  isViewingCompleted: false,
};

// ========== Helpers ==========

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function isSectionComplete(sectionId: string, items: KnowledgeItem[]): boolean {
  const sectionItems = items.filter(i => i.sectionId === sectionId);
  return sectionItems.every(i => i.status === 'completed');
}

function canAccessSection(sectionId: string, sections: typeof SECTIONS, items: KnowledgeItem[]): boolean {
  const sectionIndex = sections.findIndex(s => s.id === sectionId);
  if (sectionIndex === 0) return true;

  // All previous sections must be complete
  for (let i = 0; i < sectionIndex; i++) {
    if (!isSectionComplete(sections[i].id, items)) {
      return false;
    }
  }
  return true;
}

function getNextPendingItem(items: KnowledgeItem[], sections: typeof SECTIONS): KnowledgeItem | null {
  // Find the first incomplete section, then the first pending item in it
  for (const section of sections) {
    const sectionItems = items.filter(i => i.sectionId === section.id);
    const pendingItem = sectionItems.find(i => i.status === 'pending');
    if (pendingItem) return pendingItem;

    // If section has incomplete items, don't move to next section
    if (!sectionItems.every(i => i.status === 'completed')) {
      return null;
    }
  }
  return null;
}

// ========== Reducer ==========

function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'SELECT_ITEM': {
      const { itemId, isReview } = action.payload;

      if (!itemId) {
        return { ...state, currentItemId: null, isViewingCompleted: false };
      }

      const selectedItem = state.items.find(i => i.id === itemId);
      if (!selectedItem) return state;

      // Check if this is reviewing a completed item
      const isViewingCompleted = isReview || selectedItem.status === 'completed';

      // If not reviewing, update item statuses
      let updatedItems = state.items;
      if (!isViewingCompleted) {
        updatedItems = state.items.map(item => {
          if (item.id === state.currentItemId && item.status === 'active') {
            return { ...item, status: 'pending' as const };
          }
          if (item.id === itemId && item.status === 'pending') {
            return { ...item, status: 'active' as const };
          }
          return item;
        });
      }

      // Determine if we should show follow-up (for active items with response)
      const isAwaitingFollowUp = !isViewingCompleted &&
        selectedItem.response !== undefined &&
        selectedItem.status !== 'completed';

      return {
        ...state,
        items: updatedItems,
        currentItemId: itemId,
        expandedSectionId: selectedItem.sectionId,
        isAwaitingFollowUp,
        isViewingCompleted,
      };
    }

    case 'TOGGLE_SECTION':
      return {
        ...state,
        expandedSectionId: state.expandedSectionId === action.payload ? null : action.payload,
      };

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id ? action.payload : item
        ),
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        conversationHistory: [...state.conversationHistory, action.payload],
      };

    case 'SET_AWAITING_FOLLOW_UP':
      return { ...state, isAwaitingFollowUp: action.payload };

    case 'SET_TYPING':
      return { ...state, isTyping: action.payload };

    case 'GENERATE_KNOWLEDGE_CARD':
      return { ...state, knowledgeCard: DEFAULT_KNOWLEDGE_CARD };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ========== Context ==========

interface DemoContextValue {
  state: DemoState;
  currentItem: KnowledgeItem | null;
  selectItem: (itemId: string, isReview?: boolean) => void;
  toggleSection: (sectionId: string) => void;
  sendMessage: (message: string) => void;
  continueToNext: () => void;
  skipItem: () => void;
  reset: () => void;
  isAllComplete: boolean;
  canAccessItem: (itemId: string) => boolean;
  getCurrentSectionItems: () => KnowledgeItem[];
}

const DemoContext = createContext<DemoContextValue | null>(null);

// ========== Provider ==========

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, initialState);

  const currentItem = state.currentItemId
    ? state.items.find(i => i.id === state.currentItemId) || null
    : null;

  const progress = getTotalProgress(state.items);
  const isAllComplete = progress.completed === progress.total;

  const canAccessItem = useCallback((itemId: string): boolean => {
    const item = state.items.find(i => i.id === itemId);
    if (!item) return false;

    // Can always access completed items for review
    if (item.status === 'completed') return true;

    // Check if section is accessible
    return canAccessSection(item.sectionId, state.sections, state.items);
  }, [state.items, state.sections]);

  const selectItem = useCallback((itemId: string, isReview = false) => {
    if (!itemId) {
      dispatch({ type: 'SELECT_ITEM', payload: { itemId: '' } });
      return;
    }

    const item = state.items.find(i => i.id === itemId);
    if (!item) return;

    // Check access
    if (!canAccessItem(itemId) && !isReview) {
      return; // Can't access this item yet
    }

    // Add AI question to conversation if this is a new active item
    if (item.status === 'pending' && !isReview) {
      const aiMessage: ConversationMessage = {
        id: generateMessageId(),
        role: 'ai',
        content: item.question,
        itemId: item.id,
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });
    }

    dispatch({ type: 'SELECT_ITEM', payload: { itemId, isReview } });
  }, [state.items, canAccessItem]);

  const toggleSection = useCallback((sectionId: string) => {
    dispatch({ type: 'TOGGLE_SECTION', payload: sectionId });
  }, []);

  const getCurrentSectionItems = useCallback(() => {
    if (!currentItem) return [];
    return getItemsBySection(currentItem.sectionId, state.items);
  }, [currentItem, state.items]);

  const sendMessage = useCallback((message: string) => {
    if (!currentItem || state.isViewingCompleted || !message.trim()) return;

    const phase = state.isAwaitingFollowUp ? 'followUp' : 'initial';

    // Add user message to conversation
    const userMessage: ConversationMessage = {
      id: generateMessageId(),
      role: 'user',
      content: message.trim(),
      itemId: currentItem.id,
      timestamp: Date.now(),
      isFollowUp: state.isAwaitingFollowUp,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });

    // Update the item with the response
    if (!state.isAwaitingFollowUp) {
      const updatedItem: KnowledgeItem = {
        ...currentItem,
        response: message.trim(),
      };
      dispatch({ type: 'UPDATE_ITEM', payload: updatedItem });

      // Show typing indicator then scripted AI response
      dispatch({ type: 'SET_TYPING', payload: true });
      setTimeout(() => {
        dispatch({ type: 'SET_TYPING', payload: false });

        // Get scripted response (includes follow-up naturally)
        const aiResponse = getScriptedResponse(currentItem.id, phase, message.trim());

        const aiMessage: ConversationMessage = {
          id: generateMessageId(),
          role: 'ai',
          content: aiResponse || currentItem.followUpQuestion,
          itemId: currentItem.id,
          timestamp: Date.now(),
          isFollowUp: true,
        };
        dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });
        dispatch({ type: 'SET_AWAITING_FOLLOW_UP', payload: true });
      }, 800);
    } else {
      // Save follow-up response
      const updatedItem: KnowledgeItem = {
        ...currentItem,
        followUpResponse: message.trim(),
      };
      dispatch({ type: 'UPDATE_ITEM', payload: updatedItem });

      // Show typing indicator then scripted acknowledgment
      dispatch({ type: 'SET_TYPING', payload: true });
      setTimeout(() => {
        dispatch({ type: 'SET_TYPING', payload: false });

        // Get scripted response for follow-up
        const aiResponse = getScriptedResponse(currentItem.id, 'followUp', message.trim());

        if (aiResponse) {
          const ackMessage: ConversationMessage = {
            id: generateMessageId(),
            role: 'ai',
            content: aiResponse,
            itemId: currentItem.id,
            timestamp: Date.now(),
          };
          dispatch({ type: 'ADD_MESSAGE', payload: ackMessage });
        }
      }, 600);
    }
  }, [currentItem, state.isAwaitingFollowUp, state.isViewingCompleted]);

  const continueToNext = useCallback(() => {
    if (!currentItem || state.isViewingCompleted) return;

    // Mark current item as completed
    const updatedItem: KnowledgeItem = {
      ...currentItem,
      status: 'completed',
    };
    dispatch({ type: 'UPDATE_ITEM', payload: updatedItem });
    dispatch({ type: 'SET_AWAITING_FOLLOW_UP', payload: false });

    // Check if all complete
    const allItems = state.items.map(i => i.id === currentItem.id ? updatedItem : i);
    const completedCount = allItems.filter(i => i.status === 'completed').length;

    if (completedCount === allItems.length) {
      // Add completion message
      const completionMessage: ConversationMessage = {
        id: generateMessageId(),
        role: 'ai',
        content: "Excellent! You've completed all the knowledge capture items. I'm generating your knowledge card now...",
        itemId: currentItem.id,
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_MESSAGE', payload: completionMessage });

      setTimeout(() => {
        dispatch({ type: 'GENERATE_KNOWLEDGE_CARD' });
        dispatch({ type: 'SELECT_ITEM', payload: { itemId: '' } });
      }, 500);
    } else {
      // Find next pending item (respecting section order)
      const nextItem = getNextPendingItem(allItems, state.sections);
      if (nextItem) {
        // Add transition message
        const transitionMessage: ConversationMessage = {
          id: generateMessageId(),
          role: 'ai',
          content: `Great, let's move on to the next topic: "${nextItem.title}"`,
          itemId: currentItem.id,
          timestamp: Date.now(),
        };
        dispatch({ type: 'ADD_MESSAGE', payload: transitionMessage });

        setTimeout(() => {
          // Add the next question
          const nextQuestion: ConversationMessage = {
            id: generateMessageId(),
            role: 'ai',
            content: nextItem.question,
            itemId: nextItem.id,
            timestamp: Date.now(),
          };
          dispatch({ type: 'ADD_MESSAGE', payload: nextQuestion });
          dispatch({ type: 'SELECT_ITEM', payload: { itemId: nextItem.id } });
        }, 600);
      }
    }
  }, [currentItem, state.items, state.sections, state.isViewingCompleted]);

  const skipItem = useCallback(() => {
    if (!currentItem || state.isViewingCompleted) return;

    // Add skip message
    const skipMessage: ConversationMessage = {
      id: generateMessageId(),
      role: 'user',
      content: '[Skipped this question]',
      itemId: currentItem.id,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_MESSAGE', payload: skipMessage });

    // Use continueToNext logic
    continueToNext();
  }, [currentItem, state.isViewingCompleted, continueToNext]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value: DemoContextValue = {
    state,
    currentItem,
    selectItem,
    toggleSection,
    sendMessage,
    continueToNext,
    skipItem,
    reset,
    isAllComplete,
    canAccessItem,
    getCurrentSectionItems,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

// ========== Hook ==========

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}
