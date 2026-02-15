// ===========================================
// MANAGER INTERVIEW MOCK DATA
// Edit these values to customize the demo
// ===========================================

export interface Manager {
  id: string
  name: string
  title: string
  department: string
  initials: string
}

export interface Employee {
  name: string
  title: string
  department: string
}

export interface ConversationMessage {
  id: string
  role: 'ai' | 'manager'
  content: string
  timestamp: number
  /** Source file the question references (AI messages only) */
  sourceFile?: string
  /** The raw analytical question before rephrasing (AI messages only) */
  rawQuestion?: string
}

export interface ScriptedExchange {
  id: string
  aiMessage: string
  managerResponse: string
  priorityExtracted?: string // What Bridge AI learns from this exchange
}

// ===========================================
// PEOPLE
// ===========================================

export const MANAGER: Manager = {
  id: 'david-park-001',
  name: 'David Park',
  title: 'Head of Credit Risk',
  department: 'Credit Risk',
  initials: 'DP',
}

export const DEPARTING_EMPLOYEE: Employee = {
  name: 'Alice Chen',
  title: 'Risk Analyst',
  department: 'Credit Risk',
}

// ===========================================
// SCRIPTED CONVERSATION
// The AI interviews the manager to understand priorities
// ===========================================

export const CONVERSATION_SCRIPT: ScriptedExchange[] = [
  {
    id: 'intro',
    aiMessage: `Hi David, I'm Bridge AI. I'll be helping capture Alice's knowledge before she leaves. What aspects of her work concern you most?`,
    managerResponse: `The loss forecasting overlays. She's the only one who knows how to adjust the model outputs.`,
    priorityExtracted: 'Manual overlay process for loss forecasting',
  },
  {
    id: 'wrap-up',
    aiMessage: `I found undocumented overlay logic in her spreadsheets - adjustments of 1.2% to 4.5% with no rationale. I'll focus on capturing that decision framework. Anyone else I should loop in?`,
    managerResponse: `Yes, make sure Marcus in Risk Analytics gets the documentation. He's the backup but hasn't been trained yet.`,
    priorityExtracted: 'Marcus needs training as backup',
  },
]

// ===========================================
// TIMING CONFIGURATION
// ===========================================

export const TIMING = {
  initialDelayMs: 500,        // Delay before first AI message
  typingSpeedMs: 30,          // Milliseconds per character for auto-fill
  aiResponseDelayMs: 800,     // Delay before AI responds
  aiTypingIndicatorMs: 1200,  // How long to show "typing..." for AI
}

// ===========================================
// HELPERS
// ===========================================

export function getExchangeById(id: string): ScriptedExchange | undefined {
  return CONVERSATION_SCRIPT.find(e => e.id === id)
}

export function getNextExchange(currentId: string | null): ScriptedExchange | undefined {
  if (!currentId) return CONVERSATION_SCRIPT[0]
  const currentIndex = CONVERSATION_SCRIPT.findIndex(e => e.id === currentId)
  return CONVERSATION_SCRIPT[currentIndex + 1]
}

export function isLastExchange(id: string): boolean {
  return CONVERSATION_SCRIPT[CONVERSATION_SCRIPT.length - 1].id === id
}

export function getAllPriorities(): string[] {
  return CONVERSATION_SCRIPT
    .filter(e => e.priorityExtracted)
    .map(e => e.priorityExtracted!)
}
