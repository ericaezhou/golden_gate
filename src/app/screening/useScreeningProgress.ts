import { useState, useEffect, useCallback } from 'react'
import { TASKS, KNOWLEDGE_GAPS, TIMING, Task, KnowledgeGap } from './mockData'

export interface ScreeningState {
  // Current progress
  currentTaskIndex: number
  currentActivityIndex: number
  currentFileIndex: number

  // Derived state for display
  currentTaskId: string | null
  currentActivity: string | null
  currentFile: string | null

  // Collections
  completedTaskIds: Set<string>
  discoveredGaps: KnowledgeGap[]

  // Status
  isComplete: boolean
  isRunning: boolean
}

export function useScreeningProgress() {
  const [state, setState] = useState<ScreeningState>({
    currentTaskIndex: 0,
    currentActivityIndex: 0,
    currentFileIndex: 0,
    currentTaskId: null,
    currentActivity: null,
    currentFile: null,
    completedTaskIds: new Set(),
    discoveredGaps: [],
    isComplete: false,
    isRunning: false,
  })

  const startScreening = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRunning: true,
      currentTaskId: TASKS[0]?.id ?? null,
      currentActivity: TASKS[0]?.activities[0]?.description ?? null,
      currentFile: TASKS[0]?.activities[0]?.files[0] ?? null,
    }))
  }, [])

  // File cycling effect - updates the current file being scanned
  useEffect(() => {
    if (!state.isRunning || state.isComplete) return

    const task = TASKS[state.currentTaskIndex]
    if (!task) return

    const activity = task.activities[state.currentActivityIndex]
    if (!activity) return

    const interval = setInterval(() => {
      setState((prev) => {
        const nextFileIndex = (prev.currentFileIndex + 1) % activity.files.length
        return {
          ...prev,
          currentFileIndex: nextFileIndex,
          currentFile: activity.files[nextFileIndex],
        }
      })
    }, TIMING.fileUpdateIntervalMs)

    return () => clearInterval(interval)
  }, [state.isRunning, state.isComplete, state.currentTaskIndex, state.currentActivityIndex])

  // Activity progression effect - moves through tasks and activities
  useEffect(() => {
    if (!state.isRunning || state.isComplete) return

    const task = TASKS[state.currentTaskIndex]
    if (!task) return

    const activity = task.activities[state.currentActivityIndex]
    if (!activity) return

    const timeout = setTimeout(() => {
      setState((prev) => {
        const currentTask = TASKS[prev.currentTaskIndex]
        const isLastActivity =
          prev.currentActivityIndex >= currentTask.activities.length - 1
        const isLastTask = prev.currentTaskIndex >= TASKS.length - 1

        if (isLastActivity && isLastTask) {
          // All done!
          const newCompleted = new Set(prev.completedTaskIds)
          newCompleted.add(currentTask.id)

          // Discover any remaining gaps
          const newGaps = [...prev.discoveredGaps]
          KNOWLEDGE_GAPS.forEach((gap) => {
            if (
              gap.discoveredAtTaskId === currentTask.id &&
              !newGaps.find((g) => g.id === gap.id)
            ) {
              newGaps.push(gap)
            }
          })

          return {
            ...prev,
            completedTaskIds: newCompleted,
            discoveredGaps: newGaps,
            isComplete: true,
            currentActivity: null,
            currentFile: null,
          }
        }

        if (isLastActivity) {
          // Move to next task
          const newCompleted = new Set(prev.completedTaskIds)
          newCompleted.add(currentTask.id)

          // Discover gaps for completed task
          const newGaps = [...prev.discoveredGaps]
          KNOWLEDGE_GAPS.forEach((gap) => {
            if (
              gap.discoveredAtTaskId === currentTask.id &&
              !newGaps.find((g) => g.id === gap.id)
            ) {
              newGaps.push(gap)
            }
          })

          const nextTask = TASKS[prev.currentTaskIndex + 1]
          return {
            ...prev,
            currentTaskIndex: prev.currentTaskIndex + 1,
            currentActivityIndex: 0,
            currentFileIndex: 0,
            currentTaskId: nextTask.id,
            currentActivity: nextTask.activities[0].description,
            currentFile: nextTask.activities[0].files[0],
            completedTaskIds: newCompleted,
            discoveredGaps: newGaps,
          }
        }

        // Move to next activity within same task
        const nextActivity = currentTask.activities[prev.currentActivityIndex + 1]
        return {
          ...prev,
          currentActivityIndex: prev.currentActivityIndex + 1,
          currentFileIndex: 0,
          currentActivity: nextActivity.description,
          currentFile: nextActivity.files[0],
        }
      })
    }, activity.durationMs)

    return () => clearTimeout(timeout)
  }, [state.isRunning, state.isComplete, state.currentTaskIndex, state.currentActivityIndex])

  // Auto-start after initial delay
  useEffect(() => {
    const timeout = setTimeout(() => {
      startScreening()
    }, TIMING.initialDelayMs)

    return () => clearTimeout(timeout)
  }, [startScreening])

  return {
    ...state,
    tasks: TASKS,
    startScreening,
  }
}
