import { useState, useEffect, useRef } from 'react'
import { Task, KnowledgeGap } from './mockData'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface LiveState {
  tasks: Task[]
  completedTaskIds: Set<string>
  currentTaskId: string | null
  currentActivity: string | null
  currentFile: string | null
  discoveredGaps: KnowledgeGap[]
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
    isComplete: false,
    isRunning: true,
    error: null,
  })

  const gapCounter = useRef(0)

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
      setState(prev => ({
        ...prev,
        currentFile: data.file_name,
        currentActivity: `Deep dive pass ${data.pass_number} on ${data.file_name}`,
      }))
    })

    es.addEventListener('gap_discovered', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      gapCounter.current += 1
      const gap: KnowledgeGap = {
        id: `gap-${gapCounter.current}`,
        title: data.title,
        description: data.description,
        severity: data.severity || 'medium',
        discoveredAtTaskId: 'deep_dive',
      }
      setState(prev => ({
        ...prev,
        discoveredGaps: [...prev.discoveredGaps, gap],
      }))
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
    default: return step.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}
