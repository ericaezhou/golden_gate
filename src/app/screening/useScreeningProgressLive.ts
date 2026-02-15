import { useState, useEffect, useRef } from 'react'
import { Task, KnowledgeGap, QuestionItem } from './mockData'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface LiveState {
  tasks: Task[]
  completedTaskIds: Set<string>
  currentTaskId: string | null
  currentActivity: string | null
  currentFile: string | null
  discoveredGaps: KnowledgeGap[]
  questions: QuestionItem[]
  parsedFiles: string[]
  deepDivedFiles: string[]
  isComplete: boolean
  isRunning: boolean
  error: string | null
}

/**
 * SSE-backed hook that maps real backend events to the same state shape
 * that the screening page components expect.
 */
export function useScreeningProgressLive(sessionId: string) {
  const [state, setState] = useState<LiveState>({
    tasks: [],
    completedTaskIds: new Set(),
    currentTaskId: null,
    currentActivity: 'Connecting to server...',
    currentFile: null,
    discoveredGaps: [],
    questions: [],
    parsedFiles: [],
    deepDivedFiles: [],
    isComplete: false,
    isRunning: true,
    error: null,
  })

  const gapCounter = useRef(0)
  const questionCounter = useRef(0)

  useEffect(() => {
    if (!sessionId) return

    const url = `${API_BASE}/api/offboarding/${sessionId}/stream`
    const es = new EventSource(url)

    es.addEventListener('step_started', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setState(prev => {
        const taskId = data.step
        // Add task to list if not already present
        const exists = prev.tasks.some(t => t.id === taskId)
        const tasks = exists
          ? prev.tasks
          : [...prev.tasks, {
              id: taskId,
              label: _stepLabel(taskId),
              activities: [{ description: data.message, files: [], durationMs: 0 }],
            }]
        return {
          ...prev,
          tasks,
          currentTaskId: taskId,
          currentActivity: data.message,
          currentFile: data.file_name || null,
        }
      })
    })

    es.addEventListener('file_parsed', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setState(prev => ({
        ...prev,
        currentFile: data.file_name,
        currentActivity: `Parsed ${data.file_name}`,
        parsedFiles: prev.parsedFiles.includes(data.file_name)
          ? prev.parsedFiles
          : [...prev.parsedFiles, data.file_name],
      }))
    })

    es.addEventListener('step_completed', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setState(prev => {
        const newCompleted = new Set(prev.completedTaskIds)
        newCompleted.add(data.step)
        return {
          ...prev,
          completedTaskIds: newCompleted,
          currentActivity: data.message,
        }
      })
    })

    es.addEventListener('deep_dive_pass', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      const fileName = data.file_name
      setState(prev => ({
        ...prev,
        currentFile: fileName,
        currentActivity: `Analyzing ${fileName}`,
        deepDivedFiles: prev.deepDivedFiles.includes(fileName)
          ? prev.deepDivedFiles
          : [...prev.deepDivedFiles, fileName],
      }))
    })

    // Raw gap_discovered events are ignored — we only show consolidated gaps
    // from the gaps_reconciled event after global_summarize deduplicates them.

    es.addEventListener('gaps_reconciled', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      const gaps: KnowledgeGap[] = (data.gaps || []).map((g: { text: string; severity: string; source_files?: string[] }, i: number) => ({
        id: `gap-${i + 1}`,
        text: g.text,
        severity: (g.severity || 'medium') as 'high' | 'medium' | 'low',
        sourceFile: g.source_files?.join(', '),
      }))
      gapCounter.current = gaps.length
      setState(prev => ({
        ...prev,
        discoveredGaps: gaps,
      }))
    })

    es.addEventListener('question_discovered', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      questionCounter.current += 1
      const question: QuestionItem = {
        id: `q-${questionCounter.current}`,
        text: data.question_text,
        sourceFile: data.source_file || '',
        priority: data.priority || 'P1',
      }
      setState(prev => ({
        ...prev,
        questions: [...prev.questions, question],
      }))
    })

    es.addEventListener('interview_ready', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setState(prev => ({
        ...prev,
        isComplete: true,
        isRunning: false,
        currentActivity: data.message || 'Analysis complete — ready for interview',
        currentFile: null,
      }))
      es.close()
    })

    es.addEventListener('complete', (e: MessageEvent) => {
      setState(prev => ({
        ...prev,
        isComplete: true,
        isRunning: false,
        currentActivity: null,
        currentFile: null,
      }))
      es.close()
    })

    es.addEventListener('pipeline_error', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setState(prev => ({
        ...prev,
        error: data.message,
        isRunning: false,
      }))
      es.close()
    })

    // Handle connection errors (network failures, server down, etc.)
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        // Normal close after complete/pipeline_error — ignore
        return
      }
      setState(prev => ({
        ...prev,
        error: 'Lost connection to server',
        isRunning: false,
      }))
      es.close()
    }

    return () => {
      es.close()
    }
  }, [sessionId])

  return state
}

function _stepLabel(step: string): string {
  switch (step) {
    case 'parse_files': return 'Parse files'
    case 'deep_dive': return 'Deep dive analysis'
    case 'collect_deep_dives': return 'Collect results'
    case 'concatenate_deep_dives': return 'Concatenate reports'
    case 'identify_gaps': return 'Identify knowledge gaps'
    case 'generate_questions': return 'Generate interview questions'
    default: return step.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}
