import {
  Employee,
  ScannedFile,
  KnowledgeSection,
  KnowledgeItem,
  ExcelPreview,
  PythonPreview,
  WordPreview,
  KnowledgeCard,
} from '@/types/demo';

// ========== Employee ==========

export const ALICE_CHEN: Employee = {
  id: 'alice-chen-001',
  name: 'Alice Chen',
  title: 'Risk Analyst',
  department: 'Credit Risk',
  initials: 'AC',
};

// ========== Files ==========

const FILES: Record<string, ScannedFile> = {
  lossForcast: {
    id: 'file-loss-forecast',
    name: 'Q3_Loss_Forecast.xlsx',
    type: 'excel',
    icon: '📊',
  },
  segmentAnalysis: {
    id: 'file-segment-analysis',
    name: 'Segment_Analysis.xlsx',
    type: 'excel',
    icon: '📊',
  },
  lossModel: {
    id: 'file-loss-model',
    name: 'loss_model.py',
    type: 'python',
    icon: '🐍',
  },
  thresholdConfig: {
    id: 'file-threshold-config',
    name: 'threshold_config.py',
    type: 'python',
    icon: '🐍',
  },
  committeeNotes: {
    id: 'file-committee-notes',
    name: 'Risk_Committee_Notes.docx',
    type: 'word',
    icon: '📄',
  },
  escalationPolicy: {
    id: 'file-escalation-policy',
    name: 'Escalation_Policy.docx',
    type: 'word',
    icon: '📄',
  },
};

// ========== File Previews ==========

const lossForcastPreview: ExcelPreview = {
  type: 'excel',
  headers: ['', 'A', 'B', 'C', 'D'],
  rows: [
    {
      rowNumber: 12,
      cells: [
        { value: 'Segment' },
        { value: 'Model' },
        { value: 'Adj' },
        { value: 'Final' },
      ],
    },
    {
      rowNumber: 13,
      cells: [
        { value: 'Prime' },
        { value: '2.3%' },
        { value: '0%' },
        { value: '2.3%' },
      ],
    },
    {
      rowNumber: 14,
      cells: [
        { value: 'Near-prime' },
        { value: '5.1%' },
        { value: '+1.2%', isHighlighted: true },
        { value: '6.3%' },
      ],
    },
    {
      rowNumber: 15,
      cells: [
        { value: 'Subprime' },
        { value: '12.4%' },
        { value: '+3.1%', isHighlighted: true },
        { value: '15.5%' },
      ],
    },
    {
      rowNumber: 16,
      cells: [
        { value: 'Deep sub' },
        { value: '22.1%' },
        { value: '+4.5%', isHighlighted: true },
        { value: '26.6%' },
      ],
    },
  ],
};

const segmentAnalysisPreview: ExcelPreview = {
  type: 'excel',
  headers: ['', 'A', 'B', 'C', 'D', 'E'],
  rows: [
    {
      rowNumber: 5,
      cells: [
        { value: 'Cohort' },
        { value: 'Vintage' },
        { value: 'Expected' },
        { value: 'Actual' },
        { value: 'Variance' },
      ],
    },
    {
      rowNumber: 6,
      cells: [
        { value: 'Q1-24' },
        { value: 'Jan' },
        { value: '4.2%' },
        { value: '5.8%' },
        { value: '+38%', isHighlighted: true },
      ],
    },
    {
      rowNumber: 7,
      cells: [
        { value: 'Q1-24' },
        { value: 'Feb' },
        { value: '4.1%' },
        { value: '5.4%' },
        { value: '+32%', isHighlighted: true },
      ],
    },
    {
      rowNumber: 8,
      cells: [
        { value: 'Q1-24' },
        { value: 'Mar' },
        { value: '4.0%' },
        { value: '4.3%' },
        { value: '+8%' },
      ],
    },
  ],
};

const lossModelPreview: PythonPreview = {
  type: 'python',
  fileName: 'loss_model.py',
  lines: [
    { lineNumber: 43, content: 'def calculate_loss_forecast(segment_data):' },
    { lineNumber: 44, content: '    """Calculate quarterly loss forecast."""' },
    { lineNumber: 45, content: '    base_rate = get_historical_loss_rate(segment_data)' },
    { lineNumber: 46, content: '    macro_adj = apply_macro_factors(segment_data)' },
    { lineNumber: 47, content: '' },
    { lineNumber: 48, content: '    # TODO: Manual overlay logic not implemented', isHighlighted: true },
    { lineNumber: 49, content: '    # Analyst applies judgment adjustments manually', isHighlighted: true },
    { lineNumber: 50, content: '' },
    { lineNumber: 51, content: '    return base_rate * macro_adj' },
  ],
};

const thresholdConfigPreview: PythonPreview = {
  type: 'python',
  fileName: 'threshold_config.py',
  lines: [
    { lineNumber: 15, content: '# Segment risk thresholds' },
    { lineNumber: 16, content: 'THRESHOLDS = {' },
    { lineNumber: 17, content: '    "prime": 0.03,       # 3% loss rate' },
    { lineNumber: 18, content: '    "near_prime": 0.07,  # 7% loss rate' },
    { lineNumber: 19, content: '    "subprime": 0.15,    # ???', isHighlighted: true },
    { lineNumber: 20, content: '    "deep_sub": None,    # No threshold set', isHighlighted: true },
    { lineNumber: 21, content: '}' },
    { lineNumber: 22, content: '' },
    { lineNumber: 23, content: '# Note: Alice knows the real thresholds', isHighlighted: true },
  ],
};

const committeeNotesPreview: WordPreview = {
  type: 'word',
  paragraphs: [
    { text: 'Risk Committee Meeting Notes - Q3 2024' },
    { text: 'Agenda Item 3: Credit Loss Reserves' },
    {
      text: 'The committee reviewed the quarterly loss forecast. Alice Chen presented the model outputs and recommended judgment adjustments for higher-risk segments based on early performance indicators.',
      highlightedText: 'judgment adjustments',
    },
    { text: 'Action: Continue monitoring cohort performance. Review overlay methodology at next meeting.' },
  ],
};

const escalationPolicyPreview: WordPreview = {
  type: 'word',
  paragraphs: [
    { text: 'Credit Risk Escalation Policy v2.1' },
    { text: 'Section 4: Loss Reserve Adjustments' },
    {
      text: '4.1 When actual losses exceed model predictions by more than 20%, the analyst should consult with the Risk Committee before applying adjustments.',
      highlightedText: 'consult with the Risk Committee',
    },
    {
      text: '4.2 For adjustments exceeding $5M impact, see Alice Chen for the specific approval workflow.',
      highlightedText: 'see Alice Chen',
    },
    { text: '4.3 Document all adjustments in the quarterly review packet.' },
  ],
};

// ========== Sections ==========

export const SECTIONS: KnowledgeSection[] = [
  {
    id: 'section-data',
    title: 'Data & Calculations',
    description: 'Spreadsheet formulas, manual adjustments, and data sources',
    icon: '📊',
    color: 'blue',
  },
  {
    id: 'section-logic',
    title: 'Decision Logic',
    description: 'The reasoning and rules behind your decisions',
    icon: '🧠',
    color: 'purple',
  },
  {
    id: 'section-process',
    title: 'Process & Governance',
    description: 'Approvals, documentation, and stakeholder coordination',
    icon: '📋',
    color: 'green',
  },
];

// ========== Knowledge Items ==========

export const ITEMS: KnowledgeItem[] = [
  // ===== Data & Calculations Section =====
  {
    id: 'item-1',
    sectionId: 'section-data',
    title: 'Manual overlay values',
    file: FILES.lossForcast,
    preview: lossForcastPreview,
    issue: 'Manual adjustments in column C override model outputs with no documented rationale.',
    question: "I found manual adjustment values in cells C14:C16 that override the model calculations. These add 1.2% to 4.5% to the loss forecasts. When do you decide to apply these manual overlays?",
    followUpQuestion: "What specific indicators or thresholds tell you how much to adjust by?",
    status: 'pending',
  },
  {
    id: 'item-2',
    sectionId: 'section-data',
    title: 'Cohort variance tracking',
    file: FILES.segmentAnalysis,
    preview: segmentAnalysisPreview,
    issue: 'Significant variance between expected and actual loss rates in Q1 cohorts, but no explanation of how this informs adjustments.',
    question: "The Q1-24 cohorts show 32-38% variance from expected loss rates. How do you use this cohort data to inform your overlay decisions?",
    followUpQuestion: "At what variance level do you typically start considering an overlay?",
    status: 'pending',
  },

  // ===== Decision Logic Section =====
  {
    id: 'item-3',
    sectionId: 'section-logic',
    title: 'Overlay decision criteria',
    file: FILES.lossModel,
    preview: lossModelPreview,
    issue: 'The model has a TODO where overlay logic should be. The decision process exists only in your head.',
    question: "The model code has a gap at lines 48-49 where the overlay decision should be made. Can you describe the mental process you use to decide when and how much to adjust?",
    followUpQuestion: "Are there any edge cases or exceptions to this logic that someone else should know about?",
    status: 'pending',
  },
  {
    id: 'item-4',
    sectionId: 'section-logic',
    title: 'Risk threshold definitions',
    file: FILES.thresholdConfig,
    preview: thresholdConfigPreview,
    issue: 'Threshold configuration has missing values and a comment referencing undocumented knowledge.',
    question: "The threshold config shows 'subprime' has a placeholder value and 'deep_sub' has no threshold at all. What are the actual thresholds you use, and why aren't they in the code?",
    followUpQuestion: "How often do these thresholds change, and what triggers a change?",
    status: 'pending',
  },

  // ===== Process & Governance Section =====
  {
    id: 'item-5',
    sectionId: 'section-process',
    title: 'Committee approval process',
    file: FILES.committeeNotes,
    preview: committeeNotesPreview,
    issue: 'Committee notes mention "judgment adjustments" but don\'t specify criteria or approval process.',
    question: "The committee notes reference 'judgment adjustments' but don't explain when they're needed or who approves them. What triggers a decision to use an overlay vs. trusting the model?",
    followUpQuestion: "Once an overlay is in place, what conditions need to be met before it can be removed?",
    status: 'pending',
  },
  {
    id: 'item-6',
    sectionId: 'section-process',
    title: 'Escalation workflow',
    file: FILES.escalationPolicy,
    preview: escalationPolicyPreview,
    issue: 'Policy document explicitly says "see Alice Chen" for the approval workflow, indicating undocumented tribal knowledge.',
    question: "The escalation policy references you by name for adjustments over $5M. What's the actual approval workflow that you follow?",
    followUpQuestion: "Who should handle these escalations when you're not available?",
    status: 'pending',
  },
];

// ========== Demo Script ==========
// Complete scripted conversation for the demo
// Alice types the "aliceTypes" text, AI responds with "aiResponse"

export interface ScriptedExchange {
  stepNumber: number;
  itemId: string;
  phase: 'initial' | 'followUp';
  aliceTypes: string;  // What Alice should type
  aiResponse: string;  // What Bridge AI responds with
}

export const DEMO_SCRIPT: ScriptedExchange[] = [
  // ===== Item 1: Manual overlay values (Q3_Loss_Forecast.xlsx) =====
  {
    stepNumber: 1,
    itemId: 'item-1',
    phase: 'initial',
    aliceTypes: "I apply overlays when I see early delinquency signals that the model hasn't caught yet. Usually it's when the 30-day delinquency rate jumps more than 15% month-over-month for a segment.",
    aiResponse: "That's a clear trigger - 15% MoM jump in 30-day delinquency. What specific indicators or thresholds tell you how much to adjust by?",
  },
  {
    stepNumber: 2,
    itemId: 'item-1',
    phase: 'followUp',
    aliceTypes: "For the adjustment amount, I use a rough rule: every 10% increase in early delinquencies translates to about 1% additional loss forecast. But I cap it at 5% because beyond that we should be reconsidering the whole segment strategy.",
    aiResponse: "Got it - 10% delinquency increase → 1% loss forecast, capped at 5%. This is exactly the kind of formula we need to capture.",
  },

  // ===== Item 2: Cohort variance tracking (Segment_Analysis.xlsx) =====
  {
    stepNumber: 3,
    itemId: 'item-2',
    phase: 'initial',
    aliceTypes: "The cohort data is my early warning system. When I see two consecutive months with >25% variance, that's my signal to start thinking about an overlay.",
    aiResponse: "Two consecutive months at >25% variance as the trigger - that makes sense. At what variance level do you typically start considering an overlay?",
  },
  {
    stepNumber: 4,
    itemId: 'item-2',
    phase: 'followUp',
    aliceTypes: "I start considering around 20% variance, but I don't act until it persists for 2 months. Single-month spikes can be noise.",
    aiResponse: "So 20% is the watch threshold, 25% for 2 months is the action threshold. That persistence check prevents overreaction to noise.",
  },

  // ===== Item 3: Overlay decision criteria (loss_model.py) =====
  {
    stepNumber: 5,
    itemId: 'item-3',
    phase: 'initial',
    aliceTypes: "My mental model is: if the macro environment has shifted but the model hasn't been recalibrated, I need to bridge that gap. I look at unemployment trends, Fed rate changes, and consumer sentiment.",
    aiResponse: "So you're essentially filling in for model lag when macro conditions shift. Are there any edge cases or exceptions to this logic that someone else should know about?",
  },
  {
    stepNumber: 6,
    itemId: 'item-3',
    phase: 'followUp',
    aliceTypes: "The big exception is new products. I'm more aggressive with overlays because we have no historical data. I typically add 20% buffer for anything less than 6 months old.",
    aiResponse: "Important exception: 20% buffer for products under 6 months old due to limited data. This is critical context that isn't documented anywhere.",
  },

  // ===== Item 4: Risk threshold definitions (threshold_config.py) =====
  {
    stepNumber: 7,
    itemId: 'item-4',
    phase: 'initial',
    aliceTypes: "The real thresholds are: subprime at 18% and deep_sub at 28%. They're not in the code because they change quarterly based on portfolio composition.",
    aiResponse: "18% for subprime, 28% for deep_sub - and they're dynamic, not hardcoded. How often do these thresholds change, and what triggers a change?",
  },
  {
    stepNumber: 8,
    itemId: 'item-4',
    phase: 'followUp',
    aliceTypes: "Thresholds change when the portfolio mix shifts significantly - usually after a marketing campaign or when we enter/exit certain markets. I recalculate them at quarter-end.",
    aiResponse: "So marketing campaigns and market entry/exit trigger recalculation at quarter-end. We should document this recalculation process.",
  },

  // ===== Item 5: Committee approval process (Risk_Committee_Notes.docx) =====
  {
    stepNumber: 9,
    itemId: 'item-5',
    phase: 'initial',
    aliceTypes: "I recommend an overlay when: 1) model is >30 days stale, 2) macro conditions changed materially, or 3) cohort performance deviates >25%. The CFO approves anything impacting reserves by more than $2M.",
    aiResponse: "Clear criteria: model staleness, macro shifts, or cohort deviation. CFO threshold at $2M. Once an overlay is in place, what conditions need to be met before it can be removed?",
  },
  {
    stepNumber: 10,
    itemId: 'item-5',
    phase: 'followUp',
    aliceTypes: "Removal requires 2 consecutive quarters of the triggering condition normalizing, plus CFO sign-off. We've had overlays persist too long before, so now I calendar reminders to review them.",
    aiResponse: "Two quarters of normalized conditions plus CFO sign-off for removal. The calendar reminder system is a good practice to document.",
  },

  // ===== Item 6: Escalation workflow (Escalation_Policy.docx) =====
  {
    stepNumber: 11,
    itemId: 'item-6',
    phase: 'initial',
    aliceTypes: "For $5M+ adjustments: I prepare a memo with data support, get Risk Committee alignment in our weekly sync, then the CFO formally approves via email. Whole process takes 3-5 business days.",
    aiResponse: "Memo → Risk Committee sync → CFO email approval, 3-5 days for $5M+. Who should handle these escalations when you're not available?",
  },
  {
    stepNumber: 12,
    itemId: 'item-6',
    phase: 'followUp',
    aliceTypes: "My backup is Marcus in the Risk Analytics team. He knows the model well but hasn't done the overlay decisions himself. I've been meaning to document this for him.",
    aiResponse: "Marcus in Risk Analytics is the designated backup. We should make sure this handoff documentation gets to him as part of your transition.",
  },
];

// Helper to get AI response for a given user input
export function getScriptedResponse(itemId: string, phase: 'initial' | 'followUp', userInput: string): string | null {
  const exchange = DEMO_SCRIPT.find(
    e => e.itemId === itemId && e.phase === phase
  );

  if (!exchange) return null;

  // For demo, we match if the input is similar enough (contains key phrases)
  // This allows for slight variations in typing
  const normalizedInput = userInput.toLowerCase().trim();
  const expectedKey = exchange.aliceTypes.toLowerCase().substring(0, 30);

  if (normalizedInput.includes(expectedKey.substring(0, 20)) || normalizedInput.length > 50) {
    return exchange.aiResponse;
  }

  // If input doesn't match but has substantial content, still respond
  if (normalizedInput.length > 20) {
    return exchange.aiResponse;
  }

  return null;
}

// Legacy format for backward compatibility
export const SAMPLE_RESPONSES: Record<string, { response: string; followUp: string }> = {
  'item-1': {
    response: "I apply overlays when I see early delinquency signals that the model hasn't caught yet. Usually it's when the 30-day delinquency rate jumps more than 15% month-over-month for a segment.",
    followUp: "For the adjustment amount, I use a rough rule: every 10% increase in early delinquencies translates to about 1% additional loss forecast. But I cap it at 5% because beyond that we should be reconsidering the whole segment strategy.",
  },
  'item-2': {
    response: "The cohort data is my early warning system. When I see two consecutive months with >25% variance, that's my signal to start thinking about an overlay. The Jan and Feb numbers here were screaming at me.",
    followUp: "I start considering an overlay around 20% variance, but I don't act until it persists for 2 months. Single-month spikes can be noise.",
  },
  'item-3': {
    response: "My mental model is: if the macro environment has shifted but the model hasn't been recalibrated, I need to bridge that gap. I look at unemployment trends, Fed rate changes, and consumer sentiment.",
    followUp: "The big exception is new products - for those I'm more aggressive with overlays because we have no historical data. I typically add 20% buffer for anything less than 6 months old.",
  },
  'item-4': {
    response: "The real thresholds are: subprime at 18% and deep_sub at 28%. They're not in the code because they change quarterly based on portfolio composition, and I didn't want hardcoded values.",
    followUp: "Thresholds change when the portfolio mix shifts significantly - usually after a marketing campaign or when we enter/exit certain markets. I recalculate them at quarter-end.",
  },
  'item-5': {
    response: "I recommend an overlay when: 1) model is >30 days stale, 2) macro conditions changed materially, or 3) cohort performance deviates >25%. The CFO has final approval on anything impacting reserves by more than $2M.",
    followUp: "Removal requires 2 consecutive quarters of the triggering condition normalizing, plus CFO sign-off. We've had overlays persist too long before, so now I calendar reminders to review them.",
  },
  'item-6': {
    response: "For $5M+ adjustments: I prepare a memo with data support, get Risk Committee alignment in our weekly sync, then the CFO formally approves via email. Whole process takes 3-5 business days.",
    followUp: "My backup is Marcus in the Risk Analytics team. He knows the model well but hasn't done the overlay decisions himself. I've been meaning to document this for him.",
  },
};

// ========== Knowledge Card ==========

export const DEFAULT_KNOWLEDGE_CARD: KnowledgeCard = {
  title: 'Credit Loss Overlay Process',
  subtitle: 'Q3 2024 - Risk Analysis Judgment Adjustments',
  triggerConditions: [
    '30-day delinquency rate increases >15% month-over-month for any segment',
    'Cohort variance exceeds 25% from expected for 2+ consecutive months',
    'Model staleness >30 days without recalibration',
    'Material macro shifts: unemployment +0.5%, Fed rate changes, consumer sentiment drops',
    'New product launches with <6 months historical data',
  ],
  actions: [
    'Calculate overlay: ~1% additional loss forecast per 10% delinquency increase (cap at 5%)',
    'For new products: apply 20% buffer as default overlay',
    'Document rationale in spreadsheet column C with date and triggering metric',
    'Prepare impact memo for adjustments >$2M',
    'Get CFO approval via email for reserve-impacting changes',
    'Update overlay tracking log and set calendar reminder for quarterly review',
  ],
  risks: [
    'Overlay persistence: reviews needed quarterly to prevent stale adjustments',
    'Single point of failure: Marcus (Risk Analytics) designated as backup but needs training',
    'Threshold drift: segment thresholds (subprime: 18%, deep_sub: 28%) need quarterly recalculation',
    'Approval bottleneck: CFO sign-off required for >$2M, 3-5 day lead time',
    'Documentation gaps: column C rationale not always complete for audit trail',
  ],
  removalConditions: [
    'Triggering condition normalized for 2 consecutive quarters',
    'Cohort performance within 5% of baseline',
    'Model recalibrated to incorporate the new patterns',
    'CFO sign-off required before removal',
    'Update tracking log with removal date and justification',
  ],
};

// ========== Helpers ==========

export function getItemsBySection(sectionId: string, items: KnowledgeItem[]): KnowledgeItem[] {
  return items.filter(item => item.sectionId === sectionId);
}

export function getSectionProgress(sectionId: string, items: KnowledgeItem[]): { completed: number; total: number } {
  const sectionItems = getItemsBySection(sectionId, items);
  const completed = sectionItems.filter(item => item.status === 'completed').length;
  return { completed, total: sectionItems.length };
}

export function getTotalProgress(items: KnowledgeItem[]): { completed: number; total: number; percent: number } {
  const completed = items.filter(item => item.status === 'completed').length;
  const total = items.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}
