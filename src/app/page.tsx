'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function EntryPage() {
  const router = useRouter()
  const [projectName, setProjectName] = useState('')
  const [onboardError, setOnboardError] = useState<string | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = projectName.trim()
    if (!name) {
      setOnboardError('Please enter a project name.')
      return
    }
    setOnboardError(null)
    setIsLookingUp(true)
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/session?${new URLSearchParams({ project_name: name })}`
      )
      if (!res.ok) {
        if (res.status === 404) {
          setOnboardError('Project not found. Run off-boarding first with this project name.')
          return
        }
        const body = await res.json().catch(() => ({}))
        const msg = body.detail ?? `Error ${res.status}`
        setOnboardError(typeof msg === 'string' ? msg : msg[0]?.msg ?? String(body.detail))
        return
      }
      const data = await res.json()
      router.push(`/onboarding?session=${data.session_id}`)
    } catch (e) {
      setOnboardError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setIsLookingUp(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-600 mb-1">Golden Gate</h1>
          <p className="text-gray-500 text-sm">Offboarding &ndash; Onboarding Agent</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Off-boarding: new project */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex flex-col">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Off-boarding</h2>
            <p className="text-sm text-gray-500 mb-6 flex-1">
              Start a new project. Upload files and run the knowledge capture pipeline. Use a unique project name.
            </p>
            <Link
              href="/offboarding"
              className="w-full px-6 py-3 font-semibold text-center rounded-lg bg-amber-600 text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              Start new project
            </Link>
          </div>

          {/* On-boarding: existing project by name */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex flex-col">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">On-boarding</h2>
            <p className="text-sm text-gray-500 mb-4 flex-1">
              Continue an existing project. Enter the project name to open its narrative and knowledge graph.
            </p>
            <form onSubmit={handleOnboardingSubmit} className="space-y-3">
              <input
                type="text"
                value={projectName}
                onChange={e => { setProjectName(e.target.value); setOnboardError(null) }}
                placeholder="Project name"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              {onboardError && (
                <p className="text-sm text-red-600">{onboardError}</p>
              )}
              <button
                type="submit"
                disabled={isLookingUp}
                className="w-full px-6 py-3 font-semibold rounded-lg bg-gray-800 text-white hover:bg-gray-900 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                {isLookingUp ? 'Looking up...' : 'Continue to onboarding'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Golden Gate &mdash; AI-powered knowledge transfer for seamless transitions
        </p>
      </div>
    </main>
  )
}
