'use client';

import { Employee, GapCategory, KnowledgeGap, SessionProgress } from '@/types/conversation';
import { GAP_CATEGORIES } from '@/data/mockGaps';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PriorityBadge } from '@/components/ui/Badge';

interface GapSidebarProps {
  employee: Employee;
  gaps: KnowledgeGap[];
  progress: SessionProgress;
  currentGapId?: string;
  currentCategory?: GapCategory;
  onSelectGap: (gapId: string) => void;
  onSelectCategory: (category: GapCategory) => void;
}

export function GapSidebar({
  employee,
  gaps,
  progress,
  currentGapId,
  currentCategory,
  onSelectGap,
  onSelectCategory,
}: GapSidebarProps) {
  return (
    <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      <EmployeeHeader employee={employee} />
      <ProgressOverview progress={progress} />
      <div className="flex-1 overflow-y-auto">
        <GapCategoryList
          gaps={gaps}
          progress={progress}
          currentGapId={currentGapId}
          currentCategory={currentCategory}
          onSelectGap={onSelectGap}
          onSelectCategory={onSelectCategory}
        />
      </div>
    </aside>
  );
}

// ========== Employee Header ==========

function EmployeeHeader({ employee }: { employee: Employee }) {
  return (
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gg-rust flex items-center justify-center text-white font-semibold text-lg">
          {employee.initials}
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">{employee.name}</h2>
          <p className="text-sm text-gray-500">{employee.title}</p>
        </div>
      </div>
    </div>
  );
}

// ========== Progress Overview ==========

function ProgressOverview({ progress }: { progress: SessionProgress }) {
  return (
    <div className="p-4 border-b border-gray-200 bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">Knowledge Captured</span>
        <span className="text-sm font-semibold text-gray-900">
          {progress.capturedGaps}/{progress.totalGaps}
        </span>
      </div>
      <ProgressBar
        value={progress.percentComplete}
        color={progress.percentComplete === 100 ? 'green' : 'blue'}
      />
    </div>
  );
}

// ========== Gap Category List ==========

interface GapCategoryListProps {
  gaps: KnowledgeGap[];
  progress: SessionProgress;
  currentGapId?: string;
  currentCategory?: GapCategory;
  onSelectGap: (gapId: string) => void;
  onSelectCategory: (category: GapCategory) => void;
}

function GapCategoryList({
  gaps,
  progress,
  currentGapId,
  currentCategory,
  onSelectGap,
  onSelectCategory,
}: GapCategoryListProps) {
  const categories = Object.keys(GAP_CATEGORIES) as GapCategory[];

  return (
    <div className="p-2">
      {categories.map((category) => {
        const categoryGaps = gaps.filter((g) => g.category === category);
        const categoryProgress = progress.categoryProgress[category];

        return (
          <GapCategoryItem
            key={category}
            category={category}
            gaps={categoryGaps}
            progress={categoryProgress}
            isExpanded={currentCategory === category}
            currentGapId={currentGapId}
            onSelectGap={onSelectGap}
            onToggle={() => onSelectCategory(category)}
          />
        );
      })}
    </div>
  );
}

// ========== Gap Category Item ==========

interface GapCategoryItemProps {
  category: GapCategory;
  gaps: KnowledgeGap[];
  progress: { total: number; captured: number; percentComplete: number };
  isExpanded: boolean;
  currentGapId?: string;
  onSelectGap: (gapId: string) => void;
  onToggle: () => void;
}

function GapCategoryItem({
  category,
  gaps,
  progress,
  isExpanded,
  currentGapId,
  onSelectGap,
  onToggle,
}: GapCategoryItemProps) {
  const categoryInfo = GAP_CATEGORIES[category];
  const isComplete = progress.captured === progress.total;

  const iconColors: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    purple: 'text-purple-600 bg-purple-100',
    orange: 'text-orange-600 bg-orange-100',
    cyan: 'text-cyan-600 bg-cyan-100',
    yellow: 'text-yellow-600 bg-yellow-100',
  };

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
          isExpanded ? 'bg-gray-100' : 'hover:bg-gray-50'
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColors[categoryInfo.color]}`}>
          <CategoryIcon category={category} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 truncate">
              {categoryInfo.label}
            </span>
            <span className="text-xs text-gray-500 ml-2">
              {isComplete ? (
                <span className="text-green-600">Done</span>
              ) : (
                `${progress.captured}/${progress.total}`
              )}
            </span>
          </div>
          <ProgressBar
            value={progress.percentComplete}
            size="sm"
            color={isComplete ? 'green' : 'blue'}
            className="mt-1"
          />
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="ml-4 mt-1 space-y-1">
          {gaps.map((gap) => (
            <GapItem
              key={gap.id}
              gap={gap}
              isSelected={currentGapId === gap.id}
              onSelect={() => onSelectGap(gap.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Gap Item ==========

interface GapItemProps {
  gap: KnowledgeGap;
  isSelected: boolean;
  onSelect: () => void;
}

function GapItem({ gap, isSelected, onSelect }: GapItemProps) {
  const isComplete = gap.status === 'captured' || gap.status === 'verified';

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-2 p-2 pl-3 rounded-lg text-left transition-colors ${
        isSelected
          ? 'bg-blue-50 border border-blue-200'
          : isComplete
          ? 'bg-green-50 hover:bg-green-100'
          : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isComplete && (
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span className={`text-sm truncate ${isComplete ? 'text-gray-500' : 'text-gray-900'}`}>
            {gap.title}
          </span>
        </div>
      </div>
      {!isComplete && <PriorityBadge priority={gap.priority} />}
    </button>
  );
}

// ========== Category Icons ==========

function CategoryIcon({ category }: { category: GapCategory }) {
  const icons: Record<GapCategory, React.ReactNode> = {
    processes: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    contacts: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    tools: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    domain: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    projects: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    tribal: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  };

  return <>{icons[category]}</>;
}
