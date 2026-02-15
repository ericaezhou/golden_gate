'use client'

import { useOffboarding } from '@/context/OffboardingContext'
import { DemoProvider, useDemo } from '@/context/DemoContext'
import { TodoSidebar } from '@/components/conversation/TodoSidebar'
import { FindingCard } from '@/components/conversation/FindingCard'
import { getTotalProgress } from '@/data/demoData'

function EmployeeContent() {
  const { setStep } = useOffboarding()
  const {
    state,
    currentItem,
    selectItem,
    toggleSection,
    sendMessage,
    continueToNext,
    skipItem,
    isAllComplete,
    canAccessItem,
  } = useDemo()

  const progress = getTotalProgress(state.items)

  const handleSelectItem = (itemId: string) => {
    const item = state.items.find(i => i.id === itemId)
    const isReview = item?.status === 'completed'
    selectItem(itemId, isReview)
  }

  return (
    <div className="h-full flex bg-gg-bg">
      <TodoSidebar
        employee={state.employee}
        sections={state.sections}
        items={state.items}
        currentItemId={state.currentItemId}
        expandedSectionId={state.expandedSectionId}
        onSelectItem={handleSelectItem}
        onToggleSection={toggleSection}
        canAccessItem={canAccessItem}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 max-w-3xl w-full mx-auto px-8 py-8 flex flex-col overflow-hidden">
          {!currentItem && !isAllComplete && (
            <div className="max-w-lg mx-auto text-center py-12 animate-fadeIn">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gg-rust flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gg-text mb-3">
                Let&apos;s capture your expertise!
              </h1>
              <p className="text-gg-secondary mb-8 leading-relaxed">
                We&apos;ve identified <strong className="text-gg-text">{progress.total} knowledge areas</strong> where your expertise is critical.
              </p>
              <button
                onClick={() => {
                  const firstPending = state.items.find(i => i.status === 'pending')
                  if (firstPending) selectItem(firstPending.id)
                }}
                className="px-8 py-3 bg-gg-accent text-white font-medium rounded-lg hover:bg-gg-accent/90 transition-colors"
              >
                Let&apos;s Get Started
              </button>
            </div>
          )}

          {currentItem && !isAllComplete && (
            <FindingCard
              item={currentItem}
              conversationHistory={state.conversationHistory}
              sectionItemIds={state.items.filter(i => i.sectionId === currentItem.sectionId).map(i => i.id)}
              isAwaitingFollowUp={state.isAwaitingFollowUp}
              isViewingCompleted={state.isViewingCompleted}
              onSendMessage={sendMessage}
              onContinue={continueToNext}
              onSkip={skipItem}
              isTyping={state.isTyping}
            />
          )}

          {isAllComplete && (
            <div className="max-w-lg mx-auto text-center py-12 animate-fadeIn">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gg-text mb-3">Great work!</h1>
              <p className="text-gg-secondary mb-8 leading-relaxed">
                All critical knowledge captured. Bridge AI will now process this into deliverables.
              </p>
              <button
                onClick={() => setStep(4)}
                className="px-8 py-3 bg-gg-accent text-white font-medium rounded-lg hover:bg-gg-accent/90 transition-colors"
              >
                Process Knowledge Transfer
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export function EmployeeStep() {
  return (
    <DemoProvider>
      <EmployeeContent />
    </DemoProvider>
  )
}
