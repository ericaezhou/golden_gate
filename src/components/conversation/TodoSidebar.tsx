'use client';

import { Employee, KnowledgeSection, KnowledgeItem } from '@/types/demo';
import { getItemsBySection, getSectionProgress, getTotalProgress } from '@/data/demoData';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface TodoSidebarProps {
  employee: Employee;
  sections: KnowledgeSection[];
  items: KnowledgeItem[];
  currentItemId: string | null;
  expandedSectionId: string | null;
  onSelectItem: (itemId: string) => void;
  onToggleSection: (sectionId: string) => void;
  canAccessItem: (itemId: string) => boolean;
}

export function TodoSidebar({
  employee,
  sections,
  items,
  currentItemId,
  expandedSectionId,
  onSelectItem,
  onToggleSection,
  canAccessItem,
}: TodoSidebarProps) {
  const totalProgress = getTotalProgress(items);

  return (
    <aside className="w-80 bg-gg-surface border-r border-gg-border flex flex-col h-full">
      {/* Employee Header */}
      <div className="p-4 border-b border-gg-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gg-rust flex items-center justify-center text-white font-semibold text-lg">
            {employee.initials}
          </div>
          <div>
            <h2 className="font-semibold text-gg-text">{employee.name}</h2>
            <p className="text-sm text-gg-secondary">{employee.title}</p>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="p-4 border-b border-gg-border bg-gg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gg-secondary">Knowledge Capture</span>
          <span className="text-sm font-bold text-gg-accent">
            {totalProgress.percent}%
          </span>
        </div>
        <ProgressBar
          value={totalProgress.percent}
          color={totalProgress.percent === 100 ? 'green' : 'blue'}
          size="md"
        />
        <p className="text-xs text-gg-muted mt-2">
          {totalProgress.completed === totalProgress.total
            ? "All done! Your expertise is captured."
            : `${totalProgress.total - totalProgress.completed} item${totalProgress.total - totalProgress.completed !== 1 ? 's' : ''} remaining`}
        </p>
      </div>

      {/* Section List */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-xs font-semibold text-gg-muted uppercase tracking-wider px-2 mb-3">
          Knowledge Areas
        </p>
        {sections.map((section, index) => {
          // Check if this section is accessible (previous sections are complete)
          const previousSectionsComplete = sections
            .slice(0, index)
            .every(s => {
              const progress = getSectionProgress(s.id, items);
              return progress.completed === progress.total;
            });

          return (
            <SectionItem
              key={section.id}
              section={section}
              items={items}
              currentItemId={currentItemId}
              isExpanded={expandedSectionId === section.id}
              isLocked={!previousSectionsComplete}
              onToggle={() => onToggleSection(section.id)}
              onSelectItem={onSelectItem}
              canAccessItem={canAccessItem}
            />
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gg-border bg-gg-card">
        <p className="text-xs text-gg-muted text-center">
          Your knowledge helps build a smarter team
        </p>
      </div>
    </aside>
  );
}

// ========== Section Item ==========

interface SectionItemProps {
  section: KnowledgeSection;
  items: KnowledgeItem[];
  currentItemId: string | null;
  isExpanded: boolean;
  isLocked: boolean;
  onToggle: () => void;
  onSelectItem: (itemId: string) => void;
  canAccessItem: (itemId: string) => boolean;
}

function SectionItem({
  section,
  items,
  currentItemId,
  isExpanded,
  isLocked,
  onToggle,
  onSelectItem,
  canAccessItem,
}: SectionItemProps) {
  const sectionItems = getItemsBySection(section.id, items);
  const progress = getSectionProgress(section.id, items);
  const isComplete = progress.completed === progress.total;

  const colorClasses: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', ring: 'ring-blue-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', ring: 'ring-purple-200' },
    green: { bg: 'bg-green-100', text: 'text-green-600', ring: 'ring-green-200' },
  };

  const colors = colorClasses[section.color] || colorClasses.blue;

  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
          isExpanded ? 'bg-gg-card ring-1 ring-gg-border' : 'hover:bg-gg-card/50'
        } ${isLocked ? 'opacity-60' : ''}`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
          isLocked ? 'bg-gg-card' : colors.bg
        }`}>
          {isLocked ? (
            <svg className="w-5 h-5 text-gg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ) : isComplete ? (
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            section.icon
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${
              isLocked ? 'text-gg-muted' : isComplete ? 'text-green-400' : 'text-gg-text'
            }`}>
              {section.title}
            </span>
            <span className={`text-xs ${
              isLocked ? 'text-gg-muted' : isComplete ? 'text-green-400' : 'text-gg-muted'
            }`}>
              {progress.completed}/{progress.total}
            </span>
          </div>
          <p className="text-xs text-gg-muted truncate mt-0.5">
            {isLocked ? 'Complete previous section to unlock' : section.description}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gg-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Items */}
      {isExpanded && (
        <div className="mt-1 ml-4 space-y-1">
          {sectionItems.map((item) => (
            <TodoItem
              key={item.id}
              item={item}
              isSelected={currentItemId === item.id}
              isAccessible={canAccessItem(item.id)}
              onSelect={() => onSelectItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Todo Item ==========

interface TodoItemProps {
  item: KnowledgeItem;
  isSelected: boolean;
  isAccessible: boolean;
  onSelect: () => void;
}

function TodoItem({ item, isSelected, isAccessible, onSelect }: TodoItemProps) {
  const isCompleted = item.status === 'completed';
  const isActive = item.status === 'active';
  const isLocked = !isAccessible && !isCompleted;

  return (
    <button
      onClick={onSelect}
      disabled={isLocked}
      className={`w-full flex items-center gap-3 p-2.5 pl-4 rounded-lg text-left transition-all ${
        isSelected
          ? 'bg-gg-accent/10 ring-1 ring-gg-accent/30'
          : isCompleted
          ? 'bg-green-500/5 hover:bg-green-500/10'
          : isLocked
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-gg-card/50'
      }`}
    >
      {/* Status Icon */}
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
        isCompleted
          ? 'bg-green-500'
          : isSelected || isActive
          ? 'bg-gg-accent'
          : isLocked
          ? 'border-2 border-gg-border bg-gg-card'
          : 'border-2 border-gg-border'
      }`}>
        {isCompleted && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {(isSelected || isActive) && !isCompleted && (
          <div className="w-2 h-2 bg-white rounded-full" />
        )}
        {isLocked && (
          <svg className="w-3 h-3 text-gg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
      </div>

      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${
          isCompleted ? 'text-gg-muted line-through' : isLocked ? 'text-gg-muted' : 'text-gg-text'
        }`}>
          {item.title}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs">{item.file.icon}</span>
          <span className="text-xs text-gg-muted truncate">{item.file.name}</span>
        </div>
      </div>

      {/* Review badge for completed items */}
      {isCompleted && (
        <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
          Review
        </span>
      )}
    </button>
  );
}
