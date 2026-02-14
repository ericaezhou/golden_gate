// ========== Employee ==========

export interface Employee {
  id: string;
  name: string;
  title: string;
  department: string;
  initials: string;
}

// ========== File Types ==========

export type FileType = 'excel' | 'python' | 'word' | 'csv';

export interface ScannedFile {
  id: string;
  name: string;
  type: FileType;
  icon: string;
}

// ========== File Previews ==========

export interface ExcelCell {
  value: string;
  isHighlighted?: boolean;
}

export interface ExcelRow {
  rowNumber: number;
  cells: ExcelCell[];
}

export interface ExcelPreview {
  type: 'excel';
  headers: string[];
  rows: ExcelRow[];
}

export interface CodeLine {
  lineNumber: number;
  content: string;
  isHighlighted?: boolean;
}

export interface PythonPreview {
  type: 'python';
  fileName: string;
  lines: CodeLine[];
}

export interface WordParagraph {
  text: string;
  highlightedText?: string;
}

export interface WordPreview {
  type: 'word';
  paragraphs: WordParagraph[];
}

export type FilePreview = ExcelPreview | PythonPreview | WordPreview;

// ========== Knowledge Item (Todo Item) ==========

export type ItemStatus = 'pending' | 'active' | 'completed';

export interface KnowledgeItem {
  id: string;
  sectionId: string;
  title: string;
  file: ScannedFile;
  preview: FilePreview;
  issue: string;
  question: string;
  followUpQuestion: string;
  status: ItemStatus;
  response?: string;
  followUpResponse?: string;
}

// ========== Section (Todo Section) ==========

export interface KnowledgeSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

// ========== Knowledge Card ==========

export interface KnowledgeCard {
  title: string;
  subtitle: string;
  triggerConditions: string[];
  actions: string[];
  risks: string[];
  removalConditions: string[];
}

// ========== Conversation ==========

export type MessageRole = 'ai' | 'user';

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  itemId: string;
  timestamp: number;
  isFollowUp?: boolean;
}

// ========== Demo State ==========

export interface DemoState {
  employee: Employee;
  sections: KnowledgeSection[];
  items: KnowledgeItem[];
  currentItemId: string | null;
  expandedSectionId: string | null;
  isAwaitingFollowUp: boolean;
  isTyping: boolean;
  knowledgeCard: KnowledgeCard | null;
  conversationHistory: ConversationMessage[];
  isViewingCompleted: boolean;
}
