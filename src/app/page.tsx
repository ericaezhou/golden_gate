'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getOffboardedEmployees, OffboardedEmployee } from '@/lib/offboarding-registry'

export default function Home() {
  const [employees, setEmployees] = useState<OffboardedEmployee[]>([])

  useEffect(() => {
    setEmployees(getOffboardedEmployees())
  }, [])

  const hasOffboarded = employees.length > 0

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Hero */}
      <div className="text-center mb-12 max-w-2xl">
        <h1 className="text-5xl font-bold mb-4 text-gg-accent">
          Golden Gate
        </h1>
        <p className="text-gg-secondary text-lg leading-relaxed">
          AI-powered knowledge transfer for seamless employee transitions
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-6 mb-16">
        <Link
          href="/offboarding"
          className="group flex items-center gap-3 px-8 py-4 bg-gg-card border border-gg-border rounded-gg
                     hover:border-gg-rust/50 hover:shadow-lg transition-all duration-200"
        >
          <span className="w-3 h-3 rounded-full bg-gg-rust group-hover:shadow-[0_0_12px_rgba(192,54,44,0.5)] transition-shadow" />
          <span className="font-semibold text-gg-text">Offboard</span>
        </Link>

        {hasOffboarded ? (
          <button
            disabled
            className="group flex items-center gap-3 px-8 py-4 bg-gg-card border border-gg-border rounded-gg
                       opacity-80 cursor-default"
            title="Select an employee from the table below to onboard"
          >
            <span className="w-3 h-3 rounded-full bg-gg-gold" />
            <span className="font-semibold text-gg-text">Onboard</span>
          </button>
        ) : (
          <div
            className="flex items-center gap-3 px-8 py-4 bg-gg-card border border-gg-border rounded-gg
                       opacity-40 cursor-not-allowed"
            title="Complete an offboarding first"
          >
            <span className="w-3 h-3 rounded-full bg-gg-gold/50" />
            <span className="font-semibold text-gg-muted">Onboard</span>
          </div>
        )}
      </div>

      {/* Recently Offboarded Table */}
      <div className="w-full max-w-3xl">
        <div className="bg-gg-card border border-gg-border rounded-gg overflow-hidden shadow-gg-glow">
          <div className="px-6 py-4 border-b border-gg-border">
            <h2 className="text-sm font-semibold text-gg-secondary uppercase tracking-wider">
              Recently Offboarded
            </h2>
          </div>

          {employees.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gg-muted text-sm">No offboarded employees yet.</p>
              <p className="text-gg-muted text-xs mt-1">Start an offboarding to capture knowledge.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gg-border text-xs text-gg-muted uppercase tracking-wider">
                  <th className="px-6 py-3 text-left font-medium">Name</th>
                  <th className="px-6 py-3 text-left font-medium">Role</th>
                  <th className="px-6 py-3 text-left font-medium">Project</th>
                  <th className="px-6 py-3 text-left font-medium">Date</th>
                  <th className="px-6 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.sessionId} className="border-b border-gg-border/50 last:border-b-0 hover:bg-gg-surface/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gg-text font-medium">{emp.employeeName}</td>
                    <td className="px-6 py-4 text-sm text-gg-secondary">{emp.roleTitle}</td>
                    <td className="px-6 py-4 text-sm text-gg-secondary">{emp.projectName}</td>
                    <td className="px-6 py-4 text-sm text-gg-muted">
                      {new Date(emp.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/onboarding?session=${emp.sessionId}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                                   bg-gg-accent/10 text-gg-accent-light border border-gg-accent/30 rounded-lg
                                   hover:bg-gg-accent/20 transition-colors"
                      >
                        Onboard
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="mt-12 text-xs text-gg-muted">
        Golden Gate &mdash; AI-powered knowledge transfer
      </p>
    </main>
  )
}
