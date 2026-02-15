// ===========================================
// Type definitions for the screening pipeline
// ===========================================

export interface Task {
  id: string
  label: string
  activities: Activity[]
}

export interface Activity {
  description: string
  files: string[]
  durationMs: number
}

export interface KnowledgeGap {
  id: string
  text: string
  severity: 'high' | 'medium' | 'low'
  sourceFile?: string
}

export interface QuestionItem {
  id: string
  text: string
  sourceFile: string
  priority: string
}
