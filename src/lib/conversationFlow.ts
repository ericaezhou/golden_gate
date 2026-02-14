import {
  ConversationPhase,
  KnowledgeGap,
  ChatMessage,
  GapCategory,
} from '@/types/conversation';
import { GAP_CATEGORIES } from '@/data/mockGaps';

// ========== Phase Transitions ==========

export const PHASE_TRANSITIONS: Record<ConversationPhase, ConversationPhase[]> = {
  overview: ['gap_selection', 'conversation'],
  gap_selection: ['overview', 'conversation'],
  conversation: ['gap_selection', 'review'],
  review: ['conversation', 'complete'],
  complete: [],
};

export function canTransitionTo(from: ConversationPhase, to: ConversationPhase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

// ========== Message Generation ==========

export function generateWelcomeMessage(employeeName: string): ChatMessage {
  const firstName = employeeName.split(' ')[0];
  return {
    id: `msg-welcome-${Date.now()}`,
    role: 'assistant',
    content: `Hi ${firstName}! I'm here to help capture your valuable knowledge before you leave.

Your teammates have identified several areas where your expertise is crucial. We'll go through these together, and I'll ask questions to help document what you know.

**What we'll cover:**
- Processes & workflows you manage
- Key contacts and relationships
- Tools and systems knowledge
- Domain expertise
- Ongoing projects
- Tribal knowledge (the undocumented stuff!)

This will help create an AI assistant that can answer questions others might have asked you.

I see we have **12 knowledge gaps** to cover. Let's start with the most critical ones. Ready to begin?`,
    timestamp: new Date().toISOString(),
    metadata: {
      isGapIntro: true,
    },
  };
}

export function generateCategoryIntroMessage(category: GapCategory, gaps: KnowledgeGap[]): ChatMessage {
  const categoryInfo = GAP_CATEGORIES[category];
  const criticalCount = gaps.filter((g) => g.priority === 'critical').length;
  const incompleteGaps = gaps.filter((g) => g.status === 'not_started' || g.status === 'in_progress');

  let statusNote = '';
  if (incompleteGaps.length === 0) {
    statusNote = '\n\nGreat news - we\'ve covered all gaps in this category!';
  } else if (criticalCount > 0) {
    statusNote = `\n\n**Note:** ${criticalCount} of these are marked as critical priority.`;
  }

  return {
    id: `msg-category-intro-${Date.now()}`,
    role: 'assistant',
    content: `Let's talk about **${categoryInfo.label}**.

${categoryInfo.description}

We've identified **${gaps.length} knowledge gap${gaps.length !== 1 ? 's' : ''}** in this area.${statusNote}

I'll guide you through each one. Just share what you know and I'll ask follow-up questions if needed.`,
    timestamp: new Date().toISOString(),
    metadata: {
      isGapIntro: true,
    },
  };
}

export function generateGapQuestionMessage(gap: KnowledgeGap): ChatMessage {
  const priorityLabel = {
    critical: 'Critical',
    high: 'High Priority',
    medium: 'Medium Priority',
    low: 'Low Priority',
  }[gap.priority];

  return {
    id: `msg-gap-question-${Date.now()}`,
    role: 'assistant',
    content: `**${gap.title}** (${priorityLabel})

${gap.description}

_Source: ${gap.source.reference}_

${gap.suggestedQuestions[0]}`,
    timestamp: new Date().toISOString(),
    relatedGapIds: [gap.id],
  };
}

export function generateFollowUpQuestion(gap: KnowledgeGap, questionIndex: number): ChatMessage {
  const nextQuestion = gap.suggestedQuestions[Math.min(questionIndex, gap.suggestedQuestions.length - 1)];

  return {
    id: `msg-followup-${Date.now()}`,
    role: 'assistant',
    content: `That's helpful! ${nextQuestion}`,
    timestamp: new Date().toISOString(),
    relatedGapIds: [gap.id],
  };
}

export function generateGapCompletionMessage(gap: KnowledgeGap): ChatMessage {
  return {
    id: `msg-gap-complete-${Date.now()}`,
    role: 'assistant',
    content: `Great! I've captured the key information about **${gap.title}**.

Would you like to add anything else about this topic, or should we move to the next gap?`,
    timestamp: new Date().toISOString(),
    relatedGapIds: [gap.id],
    metadata: {
      isSummary: true,
    },
  };
}

export function generateReviewMessage(capturedCount: number, totalCount: number): ChatMessage {
  const remaining = totalCount - capturedCount;

  return {
    id: `msg-review-${Date.now()}`,
    role: 'assistant',
    content: `**Progress Update**

We've captured knowledge for **${capturedCount} of ${totalCount}** gaps.

${remaining > 0
  ? `There are still **${remaining} gaps** remaining. Would you like to continue, or would you prefer to review what we've captured so far?`
  : `Excellent work! We've covered all the identified knowledge gaps. Would you like to review everything before we finish?`
}`,
    timestamp: new Date().toISOString(),
    metadata: {
      isSummary: true,
    },
  };
}

export function generateCompletionMessage(employeeName: string): ChatMessage {
  const firstName = employeeName.split(' ')[0];
  return {
    id: `msg-complete-${Date.now()}`,
    role: 'assistant',
    content: `Thank you so much, ${firstName}!

Your knowledge has been captured and will be used to create an AI assistant that can help your team after you leave. This ensures your expertise continues to benefit the organization.

**What happens next:**
- Your captured knowledge will be reviewed
- An AI agent will be trained on this information
- Your team will be able to ask questions as if they were asking you

Best of luck in your future endeavors!`,
    timestamp: new Date().toISOString(),
    metadata: {
      isSummary: true,
    },
  };
}

// ========== Mock AI Response Generation ==========

export function generateMockAIResponse(
  userMessage: string,
  currentGap: KnowledgeGap | null,
  questionCount: number
): ChatMessage {
  // Simple mock responses based on context
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('skip') || lowerMessage.includes('next')) {
    return {
      id: `msg-ai-${Date.now()}`,
      role: 'assistant',
      content: 'No problem! Let\'s move on to the next topic.',
      timestamp: new Date().toISOString(),
    };
  }

  if (lowerMessage.includes('done') || lowerMessage.includes('finish')) {
    return {
      id: `msg-ai-${Date.now()}`,
      role: 'assistant',
      content: 'Got it! Let me summarize what we\'ve covered.',
      timestamp: new Date().toISOString(),
    };
  }

  // If we have a current gap and the user provided a substantive response
  if (currentGap && userMessage.length > 20) {
    if (questionCount < currentGap.suggestedQuestions.length - 1) {
      return generateFollowUpQuestion(currentGap, questionCount + 1);
    } else {
      return generateGapCompletionMessage(currentGap);
    }
  }

  // Default acknowledgment
  return {
    id: `msg-ai-${Date.now()}`,
    role: 'assistant',
    content: 'Thanks for sharing that. Could you tell me more details?',
    timestamp: new Date().toISOString(),
    relatedGapIds: currentGap ? [currentGap.id] : undefined,
  };
}

// ========== Gap Selection Logic ==========

export function getNextGap(
  gaps: KnowledgeGap[],
  currentCategory?: GapCategory
): KnowledgeGap | null {
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const incompleteGaps = gaps.filter(
    (g) => g.status === 'not_started' || g.status === 'in_progress'
  );

  if (incompleteGaps.length === 0) return null;

  // If we have a current category, prefer gaps in that category
  if (currentCategory) {
    const categoryGaps = incompleteGaps.filter((g) => g.category === currentCategory);
    if (categoryGaps.length > 0) {
      return categoryGaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])[0];
    }
  }

  // Otherwise, return highest priority gap
  return incompleteGaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])[0];
}

export function getCriticalGaps(gaps: KnowledgeGap[]): KnowledgeGap[] {
  return gaps.filter((g) => g.priority === 'critical' && g.status === 'not_started');
}

export function getGapById(gaps: KnowledgeGap[], id: string): KnowledgeGap | undefined {
  return gaps.find((g) => g.id === id);
}
