'use client'

import { useEffect, useState, useCallback } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface DeepDive {
  pass_number: number
  purpose: string
  key_mechanics: string[]
  fragile_points: string[]
  at_risk_knowledge: string[]
}

interface FileData {
  file_name: string
  file_type: string
  content: string
  metadata: Record<string, unknown>
  deep_dives: DeepDive[]
}

interface FilePreviewModalProps {
  sessionId: string
  fileName: string
  onClose: () => void
}

export function FilePreviewModal({ sessionId, fileName, onClose }: FilePreviewModalProps) {
  const [data, setData] = useState<FileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'content' | 'analysis'>('content')

  const fetchFile = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/session/${sessionId}/file/${encodeURIComponent(fileName)}`
      )
      if (!res.ok) {
        throw new Error(`File not found (${res.status})`)
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }, [sessionId, fileName])

  useEffect(() => {
    fetchFile()
  }, [fetchFile])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">{fileName}</h2>
              {data && (
                <p className="text-xs text-gray-500 uppercase">{data.file_type} file</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        {data && data.deep_dives.length > 0 && (
          <div className="flex border-b border-gray-200 px-6">
            <button
              onClick={() => setActiveTab('content')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'content'
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              File Content
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'analysis'
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              AI Analysis ({data.deep_dives.length} passes)
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-gray-500">Loading file...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {data && activeTab === 'content' && (
            <div className="prose prose-sm max-w-none">
              <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap">
                {data.content || '(No content available)'}
              </pre>
            </div>
          )}

          {data && activeTab === 'analysis' && (
            <div className="space-y-6">
              {data.deep_dives.map((dd) => (
                <div key={dd.pass_number} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Pass {dd.pass_number}
                    </h3>
                    {dd.purpose && (
                      <p className="text-xs text-gray-500 mt-0.5">{dd.purpose}</p>
                    )}
                  </div>
                  <div className="p-4 space-y-4">
                    {dd.key_mechanics.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1.5">
                          Key Mechanics
                        </h4>
                        <ul className="space-y-1">
                          {dd.key_mechanics.map((m, i) => (
                            <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                              <span className="text-blue-400 mt-0.5 flex-shrink-0">-</span>
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {dd.fragile_points.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-1.5">
                          Fragile Points
                        </h4>
                        <ul className="space-y-1">
                          {dd.fragile_points.map((f, i) => (
                            <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                              <span className="text-orange-400 mt-0.5 flex-shrink-0">!</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {dd.at_risk_knowledge.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1.5">
                          At-Risk Knowledge
                        </h4>
                        <ul className="space-y-1">
                          {dd.at_risk_knowledge.map((r, i) => (
                            <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                              <span className="text-red-400 mt-0.5 flex-shrink-0">*</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
