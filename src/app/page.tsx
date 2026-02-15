'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useCallback, useEffect } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function Home() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [projectName, setProjectName] = useState('')
  const [role, setRole] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Preload demo files from backend
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
          setRole('Risk Analyst')
        }
      } catch {
        // Demo files not available — ignore
      }
    }
    loadDemoFiles()
  }, [])

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      const unique = Array.from(newFiles).filter(f => !existing.has(f.name))
      return [...prev, ...unique]
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }, [addFiles])

  const removeFile = (name: string) => {
    setFiles(prev => prev.filter(f => f.name !== name))
  }

  const handleStartOffboarding = async () => {
    if (files.length === 0) {
      setError('Please add at least one file to analyze.')
      return
    }
    if (!projectName.trim()) {
      setError('Please enter a project name.')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('project_name', projectName.trim())
      formData.append('role', role.trim())
      for (const file of files) {
        formData.append('files', file)
      }

      const res = await fetch(`${API_BASE}/api/offboarding/start`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`)
      }

      const data = await res.json()
      router.push(`/screening?session=${data.session_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start analysis')
      setIsSubmitting(false)
    }
  }

  const fileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'xlsx': case 'xls': case 'csv': return '📊'
      case 'py': return '🐍'
      case 'ipynb': return '📓'
      case 'sql': case 'sqlite': case 'db': return '🗄️'
      case 'pdf': return '📕'
      case 'pptx': case 'ppt': return '📑'
      case 'docx': case 'doc': return '📄'
      default: return '📎'
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Bridge AI
          </h1>
          <p className="text-gray-500">
            Knowledge Capture & Transfer
          </p>
        </div>

        {/* Project Name */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Project Name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="e.g. Credit Risk Forecasting"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Role */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Role (optional)
          </label>
          <input
            type="text"
            value={role}
            onChange={e => setRole(e.target.value)}
            placeholder="e.g. Risk Analyst"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Drop zone */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Files to Analyze
          </label>
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-colors duration-150
              ${isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              }
            `}
          >
            <p className="text-sm text-gray-500">
              {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              xlsx, py, docx, pdf, pptx, ipynb, sql, csv, txt
            </p>
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
          <div className="mb-4 space-y-2">
            {files.map(f => (
              <div key={f.name} className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <span>{fileIcon(f.name)}</span>
                  <span className="truncate">{f.name}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(f.name) }}
                  className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}

        {/* Start Button */}
        <button
          onClick={handleStartOffboarding}
          disabled={isSubmitting}
          className={`
            w-full px-8 py-3 font-medium rounded-lg
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${isSubmitting
              ? 'bg-blue-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }
          `}
        >
          {isSubmitting ? 'Starting...' : 'Start Knowledge Capture'}
        </button>

        <p className="mt-6 text-xs text-gray-400 text-center">
          AI-powered knowledge transfer for seamless transitions
        </p>
      </div>
    </main>
  )
}
