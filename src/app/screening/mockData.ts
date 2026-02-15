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
    label: 'Analyze spreadsheets & databases',
    activities: [
      {
        description: 'Scanning spreadsheets and databases',
        files: [
          'Q3_2024_forecast.xlsx',
          'portfolio_risk.db',
        ],
        durationMs: 2500,
      },
    ],
  },
  {
    id: 'documents',
    label: 'Analyze documents & presentations',
    activities: [
      {
        description: 'Scanning documents and presentations',
        files: [
          'model_methodology.docx',
          'board_risk_presentation.pptx',
        ],
        durationMs: 2000,
      },
    ],
  },
  {
    id: 'codebase',
    label: 'Analyze code & notebooks',
    activities: [
      {
        description: 'Scanning code and notebooks',
        files: [
          'loss_forecast_model.py',
          'stress_testing.ipynb',
          'risk_queries.sql',
          'run_notes.txt',
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
    title: 'Macro Overlay Black Box',
    description: 'Manual overlays (+1% to +5%) applied to loss forecasts without documented criteria — millions in reserve impact with no audit trail',
    severity: 'high',
    discoveredAtTaskId: 'spreadsheets',
  },
  {
    id: 'gap-2',
    title: 'Missing Escalation Playbook',
    description: 'Escalation thresholds undefined or inconsistent across files — board notification threshold is verbal-only (~$10M)',
    severity: 'high',
    discoveredAtTaskId: 'codebase',
  },
  {
    id: 'gap-3',
    title: 'Legacy Shortcut vs. Policy Method',
    description: 'Two calculation methods exist (12-quarter policy vs. 4-quarter shortcut) with no documented criteria for when to use which',
    severity: 'medium',
    discoveredAtTaskId: 'documents',
  },
]

// ===========================================
// TIMING CONFIGURATION
// ===========================================
export const TIMING = {
  fileUpdateIntervalMs: 600, // How often to update the current file
  initialDelayMs: 500, // Delay before starting
}
