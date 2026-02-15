'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export type OffboardingStep = 1 | 2 | 3 | 4 | 5

interface OffboardingState {
  step: OffboardingStep
  sessionId: string | null
  roleTitle: string
  employeeName: string
  projectName: string
  files: File[]
}

interface OffboardingContextValue extends OffboardingState {
  setStep: (step: OffboardingStep) => void
  setSessionId: (id: string) => void
  setRoleTitle: (title: string) => void
  setEmployeeName: (name: string) => void
  setProjectName: (name: string) => void
  setFiles: (files: File[]) => void
}

const OffboardingContext = createContext<OffboardingContextValue | null>(null)

export function OffboardingProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<OffboardingStep>(1)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [roleTitle, setRoleTitle] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [files, setFiles] = useState<File[]>([])

  return (
    <OffboardingContext.Provider
      value={{
        step, setStep,
        sessionId, setSessionId,
        roleTitle, setRoleTitle,
        employeeName, setEmployeeName,
        projectName, setProjectName,
        files, setFiles,
      }}
    >
      {children}
    </OffboardingContext.Provider>
  )
}

export function useOffboarding() {
  const ctx = useContext(OffboardingContext)
  if (!ctx) throw new Error('useOffboarding must be used within OffboardingProvider')
  return ctx
}
