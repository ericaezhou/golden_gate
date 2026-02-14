import {
  KnowledgeGap,
  GapCategory,
  GapCategoryInfo,
  Employee,
  ConversationSession,
  SessionProgress,
  CategoryProgress,
} from '@/types/conversation';

// ========== Category Definitions ==========

export const GAP_CATEGORIES: Record<GapCategory, GapCategoryInfo> = {
  processes: {
    id: 'processes',
    label: 'Processes & Workflows',
    description: 'Standard procedures, approval flows, and recurring tasks',
    icon: 'workflow',
    color: 'blue',
  },
  contacts: {
    id: 'contacts',
    label: 'Key Contacts',
    description: 'Important stakeholders, vendors, and internal contacts',
    icon: 'users',
    color: 'green',
  },
  tools: {
    id: 'tools',
    label: 'Tools & Systems',
    description: 'Software, platforms, and access credentials',
    icon: 'wrench',
    color: 'purple',
  },
  domain: {
    id: 'domain',
    label: 'Domain Knowledge',
    description: 'Technical expertise, architecture decisions, and codebase knowledge',
    icon: 'code',
    color: 'orange',
  },
  projects: {
    id: 'projects',
    label: 'Ongoing Projects',
    description: 'Active projects, deadlines, and handover requirements',
    icon: 'folder',
    color: 'cyan',
  },
  tribal: {
    id: 'tribal',
    label: 'Tribal Knowledge',
    description: 'Undocumented tips, workarounds, and historical context',
    icon: 'lightbulb',
    color: 'yellow',
  },
};

// ========== Mock Employee ==========

export const MOCK_EMPLOYEE: Employee = {
  id: 'sarah-chen-001',
  name: 'Sarah Chen',
  title: 'Senior Software Engineer',
  department: 'Engineering',
  email: 'sarah.chen@company.com',
  initials: 'SC',
  startDate: '2020-03-15',
  lastDay: '2024-02-15',
};

// ========== Mock Knowledge Gaps ==========

export const MOCK_GAPS: KnowledgeGap[] = [
  // Processes & Workflows
  {
    id: 'gap-001',
    category: 'processes',
    title: 'Weekly deployment process',
    description: 'The specific steps and checks performed for the weekly production deployment.',
    source: {
      type: 'teammate_scan',
      reference: 'Mentioned by Mike Johnson (Tech Lead)',
      confidence: 0.9,
    },
    priority: 'critical',
    status: 'not_started',
    suggestedQuestions: [
      'Walk me through your typical weekly deployment process.',
      'What pre-deployment checks do you always perform?',
      'Are there any common issues that arise during deployment?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'gap-002',
    category: 'processes',
    title: 'Code review standards',
    description: 'Specific patterns and anti-patterns to look for during code reviews.',
    source: {
      type: 'document_analysis',
      reference: 'Inferred from PR review history',
      confidence: 0.75,
    },
    priority: 'high',
    status: 'not_started',
    suggestedQuestions: [
      'What are the top things you look for in a code review?',
      'What are common mistakes junior developers make?',
      'How do you decide when code is "good enough"?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  // Key Contacts & Relationships
  {
    id: 'gap-003',
    category: 'contacts',
    title: 'AWS account manager',
    description: 'Contact details and relationship history with AWS enterprise support.',
    source: {
      type: 'teammate_scan',
      reference: 'Mentioned by DevOps team',
      confidence: 0.85,
    },
    priority: 'high',
    status: 'not_started',
    suggestedQuestions: [
      'Who is our primary contact at AWS?',
      'What has been the history of our support interactions?',
      'Are there any ongoing issues or escalations?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'gap-004',
    category: 'contacts',
    title: 'Cross-team dependencies',
    description: 'Key contacts in other teams you regularly coordinate with.',
    source: {
      type: 'system_detection',
      reference: 'Detected from Slack/email patterns',
      confidence: 0.7,
    },
    priority: 'medium',
    status: 'not_started',
    suggestedQuestions: [
      'Which teams do you coordinate with most frequently?',
      'Who are the key people in each team?',
      'What are the typical topics of coordination?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  // Tools & Systems
  {
    id: 'gap-005',
    category: 'tools',
    title: 'Monitoring dashboard setup',
    description: 'Custom monitoring setup and alert configurations.',
    source: {
      type: 'document_analysis',
      reference: 'Referenced in incident reports',
      confidence: 0.8,
    },
    priority: 'critical',
    status: 'not_started',
    suggestedQuestions: [
      'What monitoring tools and dashboards do you maintain?',
      'What are the key metrics you track?',
      'How do you respond when alerts fire?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'gap-006',
    category: 'tools',
    title: 'CI/CD pipeline secrets',
    description: 'Environment variables and secrets management in the build pipeline.',
    source: {
      type: 'system_detection',
      reference: 'From CI/CD configuration analysis',
      confidence: 0.95,
    },
    priority: 'critical',
    status: 'not_started',
    suggestedQuestions: [
      'Where are CI/CD secrets stored and managed?',
      'Who else has access to these secrets?',
      'What is the rotation policy?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  // Domain/Technical Knowledge
  {
    id: 'gap-007',
    category: 'domain',
    title: 'Payment processing architecture',
    description: 'Deep knowledge of the payment system architecture and design decisions.',
    source: {
      type: 'teammate_scan',
      reference: 'Identified as sole maintainer',
      confidence: 0.95,
    },
    priority: 'critical',
    status: 'not_started',
    suggestedQuestions: [
      'Can you explain the payment processing architecture?',
      'What are the key failure modes and how do you handle them?',
      'What design decisions would you make differently today?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'gap-008',
    category: 'domain',
    title: 'Legacy API quirks',
    description: 'Undocumented behaviors and workarounds in the legacy API layer.',
    source: {
      type: 'document_analysis',
      reference: 'Comments in codebase',
      confidence: 0.65,
    },
    priority: 'high',
    status: 'not_started',
    suggestedQuestions: [
      'What are the known issues with the legacy API?',
      'What workarounds have you implemented?',
      'Which parts are most fragile?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  // Ongoing Projects
  {
    id: 'gap-009',
    category: 'projects',
    title: 'Database migration project',
    description: 'Status and next steps for the ongoing PostgreSQL migration.',
    source: {
      type: 'system_detection',
      reference: 'Active Jira epic',
      confidence: 0.9,
    },
    priority: 'critical',
    status: 'not_started',
    suggestedQuestions: [
      'What is the current status of the database migration?',
      'What are the remaining milestones?',
      'What risks or blockers exist?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'gap-010',
    category: 'projects',
    title: 'API v3 design',
    description: 'Design decisions and roadmap for the new API version.',
    source: {
      type: 'teammate_scan',
      reference: 'Product manager inquiry',
      confidence: 0.85,
    },
    priority: 'high',
    status: 'not_started',
    suggestedQuestions: [
      'What is the vision for API v3?',
      'What design decisions have been made?',
      'What is the planned timeline?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  // Tribal Knowledge
  {
    id: 'gap-011',
    category: 'tribal',
    title: 'The "Thursday bug"',
    description: 'A recurring issue that appears on Thursdays that you know how to fix.',
    source: {
      type: 'teammate_scan',
      reference: 'Team folklore',
      confidence: 0.6,
    },
    priority: 'medium',
    status: 'not_started',
    suggestedQuestions: [
      'What is the Thursday bug?',
      'Why does it happen on Thursdays specifically?',
      'What is the fix?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'gap-012',
    category: 'tribal',
    title: 'Customer X special handling',
    description: 'Special configurations and handling for a major enterprise customer.',
    source: {
      type: 'teammate_scan',
      reference: 'Customer success team',
      confidence: 0.9,
    },
    priority: 'high',
    status: 'not_started',
    suggestedQuestions: [
      'What special handling does Customer X require?',
      'Why are these exceptions in place?',
      'Who is the contact at Customer X?',
    ],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
];

// ========== Helper Functions ==========

export function getGapsByCategory(gaps: KnowledgeGap[]): Record<GapCategory, KnowledgeGap[]> {
  const categories: GapCategory[] = ['processes', 'contacts', 'tools', 'domain', 'projects', 'tribal'];

  return categories.reduce((acc, category) => {
    acc[category] = gaps.filter((gap) => gap.category === category);
    return acc;
  }, {} as Record<GapCategory, KnowledgeGap[]>);
}

export function calculateProgress(gaps: KnowledgeGap[]): SessionProgress {
  const totalGaps = gaps.length;
  const capturedGaps = gaps.filter((g) => g.status === 'captured' || g.status === 'verified').length;
  const verifiedGaps = gaps.filter((g) => g.status === 'verified').length;

  const gapsByCategory = getGapsByCategory(gaps);
  const categoryProgress = Object.entries(gapsByCategory).reduce((acc, [category, categoryGaps]) => {
    const captured = categoryGaps.filter((g) => g.status === 'captured' || g.status === 'verified').length;
    acc[category as GapCategory] = {
      total: categoryGaps.length,
      captured,
      percentComplete: categoryGaps.length > 0 ? Math.round((captured / categoryGaps.length) * 100) : 0,
    };
    return acc;
  }, {} as Record<GapCategory, CategoryProgress>);

  return {
    totalGaps,
    capturedGaps,
    verifiedGaps,
    percentComplete: totalGaps > 0 ? Math.round((capturedGaps / totalGaps) * 100) : 0,
    categoryProgress,
  };
}

export function createInitialSession(employee: Employee, gaps: KnowledgeGap[]): ConversationSession {
  return {
    id: `session-${Date.now()}`,
    employeeId: employee.id,
    phase: 'overview',
    messages: [],
    gaps,
    progress: calculateProgress(gaps),
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
