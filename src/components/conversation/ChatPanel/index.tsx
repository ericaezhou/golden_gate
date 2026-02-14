'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, KnowledgeGap, GapCategory, SessionProgress } from '@/types/conversation';
import { GAP_CATEGORIES } from '@/data/mockGaps';
import { Button } from '@/components/ui/Button';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentGap?: KnowledgeGap;
  currentCategory?: GapCategory;
  progress: SessionProgress;
  isTyping: boolean;
  onSendMessage: (content: string) => void;
}

export function ChatPanel({
  messages,
  currentGap,
  currentCategory,
  progress,
  isTyping,
  onSendMessage,
}: ChatPanelProps) {
  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      <ChatHeader currentGap={currentGap} currentCategory={currentCategory} progress={progress} />
      <MessageList messages={messages} isTyping={isTyping} />
      <ChatInput onSendMessage={onSendMessage} disabled={isTyping} />
    </div>
  );
}

// ========== Chat Header ==========

interface ChatHeaderProps {
  currentGap?: KnowledgeGap;
  currentCategory?: GapCategory;
  progress: SessionProgress;
}

function ChatHeader({ currentGap, currentCategory, progress }: ChatHeaderProps) {
  const categoryInfo = currentCategory ? GAP_CATEGORIES[currentCategory] : null;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          {currentGap ? (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {categoryInfo?.label}
              </p>
              <h1 className="text-lg font-semibold text-gray-900">{currentGap.title}</h1>
            </div>
          ) : currentCategory ? (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Category</p>
              <h1 className="text-lg font-semibold text-gray-900">{categoryInfo?.label}</h1>
            </div>
          ) : (
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Knowledge Capture Session</h1>
              <p className="text-sm text-gray-500">
                {progress.capturedGaps} of {progress.totalGaps} gaps captured
              </p>
            </div>
          )}
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-blue-600">{progress.percentComplete}%</span>
          <p className="text-xs text-gray-500">Complete</p>
        </div>
      </div>
    </header>
  );
}

// ========== Message List ==========

interface MessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
}

function MessageList({ messages, isTyping }: MessageListProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      {isTyping && <TypingIndicator />}
      <div ref={endOfMessagesRef} />
    </div>
  );
}

// ========== Message ==========

interface MessageProps {
  message: ChatMessage;
}

function Message({ message }: MessageProps) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isAssistant
            ? 'bg-white border border-gray-200 text-gray-900'
            : 'bg-blue-600 text-white'
        }`}
      >
        {isAssistant && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">Bridge AI</span>
          </div>
        )}
        <div className={`text-sm whitespace-pre-wrap ${isAssistant ? 'prose prose-sm max-w-none' : ''}`}>
          <MessageContent content={message.content} isAssistant={isAssistant} />
        </div>
        <p className={`text-xs mt-2 ${isAssistant ? 'text-gray-400' : 'text-blue-200'}`}>
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

function MessageContent({ content, isAssistant }: { content: string; isAssistant: boolean }) {
  if (!isAssistant) {
    return <>{content}</>;
  }

  // Simple markdown-like parsing for assistant messages
  const lines = content.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        // Bold text
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={i} className="font-semibold text-gray-900 mb-1">
              {line.slice(2, -2)}
            </p>
          );
        }
        // Bold inline
        if (line.includes('**')) {
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return (
            <p key={i} className="mb-1">
              {parts.map((part, j) =>
                j % 2 === 1 ? (
                  <strong key={j} className="font-semibold">
                    {part}
                  </strong>
                ) : (
                  part
                )
              )}
            </p>
          );
        }
        // List items
        if (line.startsWith('- ')) {
          return (
            <p key={i} className="mb-1 pl-3">
              <span className="text-blue-600 mr-2">•</span>
              {line.slice(2)}
            </p>
          );
        }
        // Italic (source references)
        if (line.startsWith('_') && line.endsWith('_')) {
          return (
            <p key={i} className="text-gray-500 italic text-xs mb-1">
              {line.slice(1, -1)}
            </p>
          );
        }
        // Empty line
        if (line.trim() === '') {
          return <br key={i} />;
        }
        // Normal paragraph
        return (
          <p key={i} className="mb-1">
            {line}
          </p>
        );
      })}
    </>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ========== Typing Indicator ==========

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
            </svg>
          </div>
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Chat Input ==========

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Share your knowledge..."
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
        <Button
          type="submit"
          disabled={!input.trim() || disabled}
          className="h-11 px-6"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </Button>
      </form>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
