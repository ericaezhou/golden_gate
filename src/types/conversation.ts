// ========== Gap Categories ==========

export type GapCategory =
  | 'processes'
  | 'contacts'
  | 'tools'
  | 'domain'
  | 'projects'
  | 'tribal';

export interface GapCategoryInfo {
  id: GapCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
}

// ========== Knowledge Gaps ==========

export type GapStatus = 'not_started' | 'in_progress' | 'captured' | 'verified';

export type GapPriority = 'critical' | 'high' | 'medium' | 'low';

export interface KnowledgeGap {
  id: string;
  category: GapCategory;
  title: string;
  description: string;
  source: GapSource;
  priority: GapPriority;
  status: GapStatus;
  suggestedQuestions: string[];
  capturedKnowledge?: CapturedKnowledge;
  createdAt: string;
  updatedAt: string;
}

export interface GapSource {
  type: 'teammate_scan' | 'document_analysis' | 'system_detection';
  reference?: string;
  confidence: number;
}

export interface CapturedKnowledge {
  summary: string;
  details: string;
  relatedMessageIds: string[];
  capturedAt: string;
}

// ========== Chat Messages ==========

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  relatedGapIds?: string[];
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  isGapIntro?: boolean;
  isSummary?: boolean;
  suggestedActions?: string[];
}

// ========== Employee ==========

export interface Employee {
  id: string;
  name: string;
  title: string;
  department: string;
  email: string;
  initials: string;
  avatarUrl?: string;
  startDate: string;
  lastDay: string;
}

// ========== Conversation Session ==========

export type ConversationPhase =
  | 'overview'
  | 'gap_selection'
  | 'conversation'
  | 'review'
  | 'complete';

export interface ConversationSession {
  id: string;
  employeeId: string;
  phase: ConversationPhase;
  currentGapId?: string;
  currentCategory?: GapCategory;
  messages: ChatMessage[];
  gaps: KnowledgeGap[];
  progress: SessionProgress;
  startedAt: string;
  updatedAt: string;
}

export interface SessionProgress {
  totalGaps: number;
  capturedGaps: number;
  verifiedGaps: number;
  percentComplete: number;
  categoryProgress: Record<GapCategory, CategoryProgress>;
}

export interface CategoryProgress {
  total: number;
  captured: number;
  percentComplete: number;
}
