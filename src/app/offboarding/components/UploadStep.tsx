'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useOffboarding } from '@/context/OffboardingContext'
import { FileIcon, getFileExt } from '@/app/components/FileIcon'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function UploadStep() {
  const {
    files, setFiles,
    projectName, setProjectName,
    roleTitle, setRoleTitle,
    employeeName, setEmployeeName,
    setSessionId, setStep,
  } = useOffboarding()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Preload demo files
  useEffect(() => {
    async function loadDemoFiles() {
      try {
        const res = await fetch(`${API_BASE}/api/offboarding/demo-files`)
        if (!res.ok) return
        const filenames: string[] = await res.json()
        const fetched = await Promise.all(
          filenames.map(async (name) => {
            const r = await fetch(`${API_BASE}/api/offboarding/demo-files/${encodeURIComponent(name)}`)
            if (!r.ok) return null
            const blob = await r.blob()
            return new File([blob], name, { type: blob.type })
          })
        )
        const valid = fetched.filter((f): f is File => f !== null)
        if (valid.length > 0) {
          setFiles(valid)
          setProjectName('Credit Risk Forecasting')
          setEmployeeName('Alice Chen')
          setRoleTitle('Risk Analyst')
        }
      } catch {
        // Demo files not available
      }
    }
    loadDemoFiles()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const existing = new Set(files.map(f => f.name))
    const unique = Array.from(newFiles).filter(f => !existing.has(f.name))
    if (unique.length > 0) setFiles([...files, ...unique])
  }, [files, setFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
  }, [addFiles])

  const removeFile = (name: string) => {
    setFiles(files.filter(f => f.name !== name))
  }

  const handleStart = async () => {
    if (files.length === 0) { setError('Please add at least one file.'); return }
    if (!projectName.trim()) { setError('Please enter a project name.'); return }

    setError(null)
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('project_name', projectName.trim())
      formData.append('role', roleTitle.trim())
      for (const file of files) formData.append('files', file)

      const res = await fetch(`${API_BASE}/api/offboarding/start`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)

      const data = await res.json()
      setSessionId(data.session_id)
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start analysis')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="bg-gg-card border border-gg-border rounded-gg p-10 max-w-2xl w-full shadow-gg-glow">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gg-text mb-1">Upload Artifacts</h1>
          <p className="text-gg-secondary text-sm">Add the outgoing employee&apos;s files and documentation</p>
        </div>

        {/* Employee Name + Role Title */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gg-muted uppercase tracking-wider mb-1">Employee Name</label>
            <input
              type="text"
              value={employeeName}
              onChange={e => setEmployeeName(e.target.value)}
              placeholder="e.g. Alice Chen"
              className="w-full px-4 py-2.5 bg-gg-surface border border-gg-border rounded-lg text-sm text-gg-text
                         placeholder-gg-muted focus:outline-none focus:ring-2 focus:ring-gg-accent focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gg-muted uppercase tracking-wider mb-1">Role Title</label>
            <input
              type="text"
              value={roleTitle}
              onChange={e => setRoleTitle(e.target.value)}
              placeholder="e.g. Risk Analyst"
              className="w-full px-4 py-2.5 bg-gg-surface border border-gg-border rounded-lg text-sm text-gg-text
                         placeholder-gg-muted focus:outline-none focus:ring-2 focus:ring-gg-accent focus:border-transparent"
            />
          </div>
        </div>

        {/* Project Name */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gg-muted uppercase tracking-wider mb-1">Project Name</label>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="e.g. Credit Risk Forecasting"
            className="w-full px-4 py-2.5 bg-gg-surface border border-gg-border rounded-lg text-sm text-gg-text
                       placeholder-gg-muted focus:outline-none focus:ring-2 focus:ring-gg-accent focus:border-transparent"
          />
        </div>

        {/* Drop zone */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gg-muted uppercase tracking-wider mb-1">Files to Analyze</label>
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-150
              ${isDragging
                ? 'border-gg-accent bg-gg-accent/5'
                : 'border-gg-border hover:border-gg-muted bg-gg-surface/50'
              }`}
          >
            <p className="text-sm text-gg-secondary">
              {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
            </p>
            <p className="text-xs text-gg-muted mt-1">.xlsx, .py, .docx, .pdf, .pptx, .ipynb, .sql, .csv, .txt</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files) addFiles(e.target.files) }}
            />
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mb-6 space-y-2">
            {files.map(f => {
              const ext = getFileExt(f.name)
              return (
                <div
                  key={f.name}
                  className="flex items-center justify-between text-sm text-gg-text
                             bg-gg-surface hover:bg-gg-surface/80 px-3 py-2.5 rounded-lg
                             border border-gg-border transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIcon ext={ext} />
                    <span className="truncate">{f.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(f.name) }}
                    className="text-gg-muted hover:text-red-400 ml-2 flex-shrink-0
                               opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <button
          onClick={handleStart}
          disabled={isSubmitting}
          className={`w-full px-8 py-3.5 font-semibold text-base rounded-lg transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-gg-accent focus:ring-offset-2 focus:ring-offset-gg-bg
            ${isSubmitting
              ? 'bg-gg-border text-gg-muted cursor-not-allowed'
              : 'bg-gg-accent text-white hover:bg-gg-accent/90 shadow-gg-glow'
            }`}
        >
          {isSubmitting ? 'Starting...' : 'Start Knowledge Capture'}
        </button>
      </div>
    </div>
  )
}
