'use client'

import { useRouter } from 'next/navigation'

const employee = {
  name: 'Alice Chen',
  title: 'Risk Analyst',
  department: 'Credit Risk',
  initials: 'AC',
  context: 'Manages quarterly credit loss forecasts',
}

export default function Home() {
  const router = useRouter()

  const handleStartOffboarding = () => {
    router.push('/screening')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Bridge AI
        </h1>
        <p className="text-gray-500 mb-8">
          Knowledge Capture & Transfer
        </p>

        <div className="flex flex-col items-center gap-4">
          {/* Employee Avatar */}
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 ring-4 ring-gray-100 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {employee.initials}
            </span>
          </div>

          {/* Employee Info */}
          <div className="mt-2">
            <h2 className="text-xl font-semibold text-gray-900">
              {employee.name}
            </h2>
            <p className="text-gray-500">
              {employee.title}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {employee.department}
            </p>
          </div>

          {/* Context */}
          <div className="mt-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              {employee.context}
            </p>
          </div>

          {/* Files to Analyze */}
          <div className="mt-4 w-full text-left">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Files to Analyze
            </p>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span>📊</span>
                <span>Q3_Loss_Forecast.xlsx</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🐍</span>
                <span>loss_model.py</span>
              </div>
              <div className="flex items-center gap-2">
                <span>📄</span>
                <span>Risk_Committee_Notes.docx</span>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartOffboarding}
            className="mt-6 w-full px-8 py-3 bg-blue-600 text-white font-medium rounded-lg
                       hover:bg-blue-700 active:bg-blue-800
                       transition-colors duration-150
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Start Knowledge Capture
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-400">
          AI-powered knowledge transfer for seamless transitions
        </p>
      </div>
    </main>
  )
}
