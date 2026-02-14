// ===========================================
// MOCK DATA CONFIGURATION
// Edit these values to customize the screening simulation
// ===========================================

export interface Task {
  id: string
  label: string
  activities: Activity[]
}

export interface Activity {
  description: string
  files: string[]
  durationMs: number // How long to spend on this activity
}

export interface KnowledgeGap {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high'
  discoveredAtTaskId: string // Which task reveals this gap
}

// ===========================================
// TASKS CHECKLIST
// These appear in the left column
// ===========================================
export const TASKS: Task[] = [
  {
    id: 'spreadsheets',
    label: 'Analyze spreadsheets',
    activities: [
      {
        description: 'Scanning spreadsheets',
        files: [
          'Q3_Loss_Forecast.xlsx',
          'Overlay_Adjustments.xlsx',
        ],
        durationMs: 2500,
      },
    ],
  },
  {
    id: 'documents',
    label: 'Analyze documents',
    activities: [
      {
        description: 'Scanning documents',
        files: [
          'Risk_Committee_Notes.docx',
        ],
        durationMs: 2000,
      },
    ],
  },
  {
    id: 'codebase',
    label: 'Analyze codebase',
    activities: [
      {
        description: 'Scanning code',
        files: [
          'loss_model.py',
        ],
        durationMs: 2500,
      },
    ],
  },
]

// ===========================================
// KNOWLEDGE GAPS
// These appear in the right column as they're discovered
// ===========================================
export const KNOWLEDGE_GAPS: KnowledgeGap[] = [
  {
    id: 'gap-1',
    title: 'Undocumented overlay logic',
    description: 'Manual adjustments (1.2%-4.5%) lack documented rationale',
    severity: 'high',
    discoveredAtTaskId: 'spreadsheets',
  },
  {
    id: 'gap-2',
    title: 'Model calibration process',
    description: 'loss_model.py calibration steps not documented',
    severity: 'medium',
    discoveredAtTaskId: 'codebase',
  },
]

// ===========================================
// TIMING CONFIGURATION
// ===========================================
export const TIMING = {
  fileUpdateIntervalMs: 600, // How often to update the current file
  initialDelayMs: 500, // Delay before starting
}
