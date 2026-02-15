'use client';

import { useState, useRef, useEffect } from 'react';
import { KnowledgeItem, ConversationMessage } from '@/types/demo';
import { FilePreview } from './FilePreview';
import { Button } from '@/components/ui/Button';
import { DEMO_SCRIPT } from '@/data/demoData';

interface FindingCardProps {
  item: KnowledgeItem;
  conversationHistory: ConversationMessage[];
  sectionItemIds: string[]; // IDs of all items in the current section
  isAwaitingFollowUp: boolean;
  isViewingCompleted: boolean;
  onSendMessage: (message: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  isTyping: boolean;
}

export function FindingCard({
  item,
  conversationHistory,
  sectionItemIds,
  isAwaitingFollowUp,
  isViewingCompleted,
  onSendMessage,
  onContinue,
  onSkip,
  isTyping,
}: FindingCardProps) {
  // Filter conversation to only show messages from current section
  const sectionMessages = conversationHistory.filter(
    msg => sectionItemIds.includes(msg.itemId)
  );
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charIndexRef = useRef(0);

  // Get the scripted text for the current item and phase
  const getScriptedText = () => {
    const phase = isAwaitingFollowUp ? 'followUp' : 'initial';
    const exchange = DEMO_SCRIPT.find(
      e => e.itemId === item.id && e.phase === phase
    );
    return exchange?.aliceTypes || '';
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sectionMessages.length, isTyping]);

  // Reset message input and char index when item changes or phase changes
  useEffect(() => {
    setMessage('');
    charIndexRef.current = 0;
    if (!isViewingCompleted) {
      textareaRef.current?.focus();
    }
  }, [item.id, isViewingCompleted, isAwaitingFollowUp]);

  const handleSend = () => {
    if (message.trim() && !isTyping) {
      onSendMessage(message.trim());
      setMessage('');
      charIndexRef.current = 0;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (message.trim()) {
        handleSend();
      }
      return;
    }

    // For any printable character, add one character from the scripted text
    if (!isTyping && e.key.length === 1) {
      e.preventDefault();
      const scriptedText = getScriptedText();
      if (charIndexRef.current < scriptedText.length) {
        charIndexRef.current++;
        setMessage(scriptedText.slice(0, charIndexRef.current));
      }
    }
  };

  // Check if user has responded to the current question
  const hasResponded = isAwaitingFollowUp || item.response !== undefined;
  const canContinue = hasResponded && !isTyping;

  return (
    <div className="flex flex-col h-full">
      {/* File Preview - Fixed at top */}
      <div className="flex-shrink-0 mb-4">
        <FilePreview file={item.file} preview={item.preview} />

        {/* Issue Alert */}
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg mt-4">
          <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-amber-300 text-sm">{item.issue}</p>
        </div>
      </div>

      {/* Conversation Area - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pb-4">
        {sectionMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gg-rust flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="bg-gg-card rounded-2xl rounded-tl-none border border-gg-border px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed at bottom */}
      {!isViewingCompleted ? (
        <div className="flex-shrink-0 border-t border-gg-border pt-4 mt-auto">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share your knowledge..."
              disabled={isTyping}
              rows={2}
              className="flex-1 rounded-xl border border-gg-border bg-gg-bg px-4 py-3 text-sm text-gg-text placeholder-gg-muted focus:outline-none focus:ring-2 focus:ring-gg-accent focus:border-transparent resize-none disabled:bg-gg-surface"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || isTyping}
              className="px-4 py-2 bg-gg-accent text-white rounded-xl hover:bg-gg-accent/90 transition-colors disabled:bg-gg-card disabled:text-gg-muted disabled:cursor-not-allowed self-end"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <div className="flex justify-between items-center mt-3">
            <button
              onClick={onSkip}
              disabled={isTyping}
              className="text-sm text-gg-muted hover:text-gg-secondary transition-colors disabled:opacity-50"
            >
              Skip this question
            </button>
            <Button
              onClick={onContinue}
              disabled={!canContinue}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 border-t border-gg-border pt-4 mt-auto">
          <div className="flex items-center justify-between bg-green-500/10 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">This item has been completed</span>
            </div>
            <span className="text-xs text-green-400/70">Viewing in read-only mode</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== Message Bubble ==========

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isAI = message.role === 'ai';

  if (isAI) {
    return (
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gg-rust flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex-1 bg-gg-card rounded-2xl rounded-tl-none border border-gg-border p-4">
          <p className="text-xs font-medium text-gg-accent mb-1">Bridge AI</p>
          <p className="text-gg-text">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 justify-end">
      <div className="max-w-[80%] bg-gg-accent text-white rounded-2xl rounded-tr-none px-4 py-3">
        <p className="text-sm">{message.content}</p>
      </div>
    </div>
  );
}
