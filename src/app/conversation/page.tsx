'use client';

import { useRouter } from 'next/navigation';
import { DemoProvider, useDemo } from '@/context/DemoContext';
import { TodoSidebar } from '@/components/conversation/TodoSidebar';
import { FindingCard } from '@/components/conversation/FindingCard';
import { getTotalProgress } from '@/data/demoData';

export default function ConversationPage() {
  return (
    <DemoProvider>
      <ConversationContent />
    </DemoProvider>
  );
}

function ConversationContent() {
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
  } = useDemo();

  const progress = getTotalProgress(state.items);

  // Handler for sidebar item selection - pass true for review if completed
  const handleSelectItem = (itemId: string) => {
    const item = state.items.find(i => i.id === itemId);
    const isReview = item?.status === 'completed';
    selectItem(itemId, isReview);
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Sidebar - Todo List */}
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

      {/* Right Panel - Conversation */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 max-w-3xl w-full mx-auto px-8 py-8 flex flex-col overflow-hidden">
          {/* Welcome State - No item selected */}
          {!currentItem && !isAllComplete && (
            <WelcomeState
              employeeName={state.employee.name}
              progress={progress}
              onStart={() => {
                const firstPending = state.items.find(i => i.status === 'pending');
                if (firstPending) selectItem(firstPending.id);
              }}
            />
          )}

          {/* Active Item - Show FindingCard with conversation */}
          {currentItem && !isAllComplete && (
            <FindingCard
              item={currentItem}
              conversationHistory={state.conversationHistory}
              sectionItemIds={state.items
                .filter(i => i.sectionId === currentItem.sectionId)
                .map(i => i.id)}
              isAwaitingFollowUp={state.isAwaitingFollowUp}
              isViewingCompleted={state.isViewingCompleted}
              onSendMessage={sendMessage}
              onContinue={continueToNext}
              onSkip={skipItem}
              isTyping={state.isTyping}
            />
          )}

          {/* Complete - Show completion screen */}
          {isAllComplete && (
            <CompletionScreen employeeName={state.employee.name} />
          )}
        </div>
      </main>
    </div>
  );
}

// ========== Welcome State ==========

interface WelcomeStateProps {
  employeeName: string;
  progress: { completed: number; total: number; percent: number };
  onStart: () => void;
}

function WelcomeState({ employeeName, progress, onStart }: WelcomeStateProps) {
  const firstName = employeeName.split(' ')[0];

  return (
    <div className="max-w-lg mx-auto text-center py-12 animate-fadeIn">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        Hi {firstName}, let's capture your expertise!
      </h1>

      <p className="text-gray-600 mb-8 leading-relaxed">
        We've identified <strong>{progress.total} knowledge areas</strong> where your expertise
        is critical. Let's walk through each one together so your team can benefit from
        what you know.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 text-left">
        <h3 className="font-medium text-gray-900 mb-4">How this works:</h3>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
            <span>We'll go through each knowledge area in order, section by section</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
            <span>I'll show you where we found gaps and ask clarifying questions</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
            <span>Your answers build into a knowledge card your team can reference</span>
          </li>
        </ul>
      </div>

      <button
        onClick={onStart}
        className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Let's Get Started
      </button>

      <p className="text-sm text-gray-400 mt-4">
        Complete sections in order to unlock the next
      </p>
    </div>
  );
}

// ========== Completion Screen ==========

interface CompletionScreenProps {
  employeeName: string;
}

function CompletionScreen({ employeeName }: CompletionScreenProps) {
  const router = useRouter();
  const firstName = employeeName.split(' ')[0];

  return (
    <div className="max-w-lg mx-auto text-center py-12 animate-fadeIn">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        Great work, {firstName}!
      </h1>

      <p className="text-gray-600 mb-8 leading-relaxed">
        You've successfully captured all your critical knowledge. Bridge AI will now process
        this information to create deliverables for your team.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 text-left">
        <h3 className="font-medium text-gray-900 mb-4">What happens next:</h3>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
            <span>Your documents will be enhanced with the knowledge you shared</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
            <span>A workflow memo will be generated for your team</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
            <span>An AI agent will be created to answer questions about your processes</span>
          </li>
        </ul>
      </div>

      <button
        onClick={() => router.push('/handoff')}
        className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Process Knowledge Transfer
      </button>
    </div>
  );
}
