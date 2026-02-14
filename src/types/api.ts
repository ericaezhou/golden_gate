// ========== Artifact Types ==========

export interface Artifact {
  id: string;
  name: string;
  type: 'python' | 'excel' | 'word' | 'markdown';
  path: string;
  content: string;
  lastModified: string;
}

export interface ArtifactGap {
  id: string;
  artifactId: string;
  artifactName: string;
  location: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  suggestedQuestion: string;
  followUpQuestion: string;
  category: 'documentation' | 'logic' | 'process' | 'data';
}

// ========== Scan Results ==========

export interface ScanResult {
  employeeId: string;
  employeeName: string;
  scanDate: string;
  artifacts: Artifact[];
  gaps: ArtifactGap[];
  summary: {
    totalArtifacts: number;
    totalGaps: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
  };
}

// ========== Knowledge Capture ==========

export interface CapturedKnowledge {
  gapId: string;
  question: string;
  response: string;
  followUpQuestion?: string;
  followUpResponse?: string;
  capturedAt: string;
}

export interface KnowledgeSession {
  sessionId: string;
  employeeId: string;
  startedAt: string;
  completedAt?: string;
  capturedKnowledge: CapturedKnowledge[];
  status: 'in_progress' | 'completed';
}

// ========== Generated Agent ==========

export interface GeneratedAgent {
  agentId: string;
  employeeId: string;
  employeeName: string;
  role: string;
  department: string;
  createdAt: string;
  knowledgeBase: {
    artifacts: Artifact[];
    capturedKnowledge: CapturedKnowledge[];
    processedContext: string;
  };
  systemPrompt: string;
}

// ========== Chat Types ==========

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  agentId: string;
  message: string;
  conversationHistory: ChatMessage[];
}

export interface ChatResponse {
  message: string;
  sources?: string[];
}

// ========== API Request/Response Types ==========

export interface ScanRequest {
  employeeId: string;
  artifactPaths?: string[];
}

export interface AnalyzeRequest {
  artifacts: Artifact[];
}

export interface GenerateAgentRequest {
  employeeId: string;
  employeeName: string;
  role: string;
  department: string;
  artifacts: Artifact[];
  capturedKnowledge: CapturedKnowledge[];
}
