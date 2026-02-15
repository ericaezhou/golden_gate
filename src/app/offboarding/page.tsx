'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useCallback, useEffect } from 'react'
import { FileIcon, getFileExt } from '../components/FileIcon'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const extBadgeColors: Record<string, string> = {
  xlsx: 'bg-green-100 text-green-700',
  xls: 'bg-green-100 text-green-700',
  csv: 'bg-green-100 text-green-700',
  py: 'bg-blue-100 text-blue-700',
  ipynb: 'bg-orange-100 text-orange-700',
  sql: 'bg-indigo-100 text-indigo-700',
  sqlite: 'bg-indigo-100 text-indigo-700',
  db: 'bg-indigo-100 text-indigo-700',
  pdf: 'bg-red-100 text-red-700',
  pptx: 'bg-orange-100 text-orange-700',
  ppt: 'bg-orange-100 text-orange-700',
  docx: 'bg-blue-100 text-blue-700',
  doc: 'bg-blue-100 text-blue-700',
}

export default function OffboardingPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [projectName, setProjectName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        }
      } catch {
        // ignore
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
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
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
      formData.append('role', '')
      for (const file of files) {
        formData.append('files', file)
      }
      const res = await fetch(`${API_BASE}/api/offboarding/start`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = body.detail ?? (typeof body.detail === 'string' ? body.detail : `Server error: ${res.status}`)
        throw new Error(typeof msg === 'string' ? msg : msg[0]?.msg ?? String(body.detail))
      }
      const data = await res.json()
      router.push(`/screening?session=${data.session_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start analysis')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-10 max-w-2xl w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-amber-600 mb-1">Golden Gate</h1>
            <p className="text-gray-500 text-sm">Offboarding &ndash; Start new project</p>
          </div>
          <Link
            href="/"
            className="text-sm text-amber-600 hover:text-amber-700"
          >
            &larr; Entry
          </Link>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Project Name
          </label>
          <p className="text-xs text-gray-400 mb-2">Use a unique name; it will be the primary key for this project.</p>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="e.g. Credit Risk Forecasting"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Files to Analyze
          </label>
          <p className="text-xs text-gray-400 mb-2">Upload the outgoing employee&apos;s artefacts and documentation</p>
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-150
              ${isDragging ? 'border-amber-500 bg-amber-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
            `}
          >
            <p className="text-sm text-gray-500">
              {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
            </p>
            <p className="text-xs text-gray-400 mt-1">.xlsx, .py, .docx, .pdf, .pptx, .ipynb, .sql, .csv, .txt</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files) addFiles(e.target.files) }}
            />
          </div>
        </div>

        {files.length > 0 && (
          <div className="mb-6 space-y-2">
            {files.map(f => {
              const ext = getFileExt(f.name)
              const badgeColor = extBadgeColors[ext] || 'bg-gray-100 text-gray-500'
              return (
                <div
                  key={f.name}
                  className="flex items-center justify-between text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-2.5 rounded-lg border border-gray-200 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIcon ext={ext} />
                    <span className="truncate">{f.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-medium ${badgeColor}`}>.{ext}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(f.name) }}
                    className="text-gray-300 hover:text-red-500 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
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

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          onClick={handleStartOffboarding}
          disabled={isSubmitting}
          className={`
            w-full px-8 py-3.5 font-semibold text-base rounded-lg transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2
            ${isSubmitting ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 shadow-md hover:shadow-lg'}
          `}
        >
          {isSubmitting ? 'Starting...' : 'Start Knowledge Capture'}
        </button>

        <p className="mt-8 text-xs text-gray-400 text-center">
          Golden Gate &mdash; AI-powered knowledge transfer for seamless transitions
        </p>
      </div>
    </main>
  )
}
