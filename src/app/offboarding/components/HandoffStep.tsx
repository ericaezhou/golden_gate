'use client';

import { useState, useEffect, useRef } from 'react';
import { ALICE_CHEN } from '@/data/demoData';
import { useOffboarding } from '@/context/OffboardingContext';

type Phase = 'documents' | 'memo' | 'agent' | 'complete';
type ReviewAction = 'pending' | 'accepted' | 'declined' | 'context';

interface ProposedChange {
  id: string;
  fileName: string;
  fileIcon: string;
  fileType: 'python' | 'markdown' | 'config';
  location: string;
  issue: string;
  currentCode: string;
  proposedCode: string;
  rationale: string;
  status: ReviewAction;
  additionalContext?: string;
  suggestedContext?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

// Proposed document enhancements based on Alice's captured knowledge
const PROPOSED_CHANGES: ProposedChange[] = [
  {
    id: 'change-1',
    fileName: 'loss_model.py',
    fileIcon: '\uD83D\uDC0D',
    fileType: 'python',
    location: 'Lines 66-68',
    issue: 'TODO comment indicates overlay logic is undocumented',
    currentCode: `    # TODO: Manual overlay logic not implemented
    # Analyst applies judgment adjustments manually
    # See Alice for the specific criteria used`,
    proposedCode: `    # Manual Overlay Logic (documented from Alice Chen's expertise)
    #
    # TRIGGER CONDITIONS:
    # 1. 30-day delinquency rate increases >15% MoM for segment
    # 2. Cohort variance exceeds 25% for 2+ consecutive months
    # 3. Model staleness >30 days without recalibration
    # 4. Material macro shift (unemployment +0.5%, Fed rate change)
    #
    # ADJUSTMENT FORMULA:
    # - Every 10% increase in early delinquencies \u2192 +1% loss forecast
    # - Maximum overlay cap: 5% (beyond this, reassess segment strategy)
    # - New products (<6 months): Apply 20% buffer by default
    #
    # overlay_adjustment = min(delinquency_increase * 0.1, 0.05)
    # if is_new_product: overlay_adjustment = max(overlay_adjustment, 0.20)`,
    rationale: 'Based on your explanation of the overlay decision criteria, including the 15% delinquency trigger, the 10%\u21921% formula, and the 5% cap.',
    status: 'pending',
  },
  {
    id: 'change-2',
    fileName: 'threshold_config.py',
    fileIcon: '\uD83D\uDC0D',
    fileType: 'config',
    location: 'Lines 10-18',
    issue: 'Missing threshold values for subprime and deep_subprime segments',
    currentCode: `SEGMENT_THRESHOLDS = {
    "prime": 0.03,        # 3% loss rate - well documented
    "near_prime": 0.07,   # 7% loss rate - well documented
    "subprime": 0.15,     # 15% - but Alice uses different number?
    "deep_subprime": None # No threshold set - ask Alice
}

# Note: Alice knows the real thresholds for subprime and deep_subprime
# They change based on portfolio composition`,
    proposedCode: `SEGMENT_THRESHOLDS = {
    "prime": 0.03,        # 3% loss rate
    "near_prime": 0.07,   # 7% loss rate
    "subprime": 0.18,     # 18% loss rate (per Alice Chen, Q4 2024)
    "deep_subprime": 0.28 # 28% loss rate (per Alice Chen, Q4 2024)
}

# THRESHOLD UPDATE PROTOCOL (documented from Alice Chen):
# - Thresholds are DYNAMIC, not static - recalculate quarterly
# - Triggers for recalculation:
#   1. Portfolio mix shifts significantly
#   2. After marketing campaigns
#   3. Market entry/exit events
# - Recalculation timing: Quarter-end
# - Owner: Risk Analyst (backup: Marcus, Risk Analytics)`,
    rationale: 'You confirmed the actual thresholds are 18% for subprime and 28% for deep_subprime, and explained they change quarterly based on portfolio composition.',
    status: 'pending',
  },
  {
    id: 'change-3',
    fileName: 'threshold_config.py',
    fileIcon: '\uD83D\uDC0D',
    fileType: 'config',
    location: 'Lines 48-53',
    issue: 'Missing overlay cap for deep_subprime segment',
    currentCode: `OVERLAY_CAPS = {
    "prime": 0.01,        # Max 1% overlay
    "near_prime": 0.02,   # Max 2% overlay
    "subprime": 0.05,     # Max 5% overlay
    "deep_subprime": None # No cap defined - Alice decides
}`,
    proposedCode: `OVERLAY_CAPS = {
    "prime": 0.01,        # Max 1% overlay
    "near_prime": 0.02,   # Max 2% overlay
    "subprime": 0.05,     # Max 5% overlay - reassess strategy if exceeded
    "deep_subprime": 0.05 # Max 5% overlay - same cap applies per Alice
}

# NOTE: If overlay would exceed 5% for ANY segment, this indicates
# the segment strategy needs reassessment rather than continued adjustment.
# Escalate to Risk Committee before applying overlays beyond cap.`,
    rationale: 'You mentioned the 5% cap applies across segments - beyond that, the strategy itself should be reconsidered.',
    status: 'pending',
  },
  {
    id: 'change-4',
    fileName: 'Escalation_Policy.md',
    fileIcon: '\uD83D\uDCC4',
    fileType: 'markdown',
    location: 'Section 4.3',
    issue: 'Policy says "see Alice Chen" without documenting the actual workflow',
    currentCode: `### 4.3 Major Adjustments (>$5M impact)

- Requires CFO formal approval via email
- Risk Committee must be informed in advance
- For adjustments exceeding $5M impact, **see Alice Chen for the specific approval workflow**
- Board notification required for adjustments >$10M`,
    proposedCode: `### 4.3 Major Adjustments (>$5M impact)

- Requires CFO formal approval via email
- Risk Committee must be informed in advance
- Board notification required for adjustments >$10M

**Detailed Approval Workflow for >$5M Adjustments:**

1. **Prepare Memo** (1-2 days)
   - Include data support: cohort performance, macro indicators, delinquency trends
   - Calculate dollar impact and percentage change to reserves
   - Draft recommendation with clear rationale

2. **Risk Committee Alignment** (Weekly sync meeting)
   - Present memo and supporting analysis
   - Obtain committee alignment before formal approval
   - Document any concerns or conditions

3. **CFO Formal Approval** (1-2 days)
   - Send memo via email to CFO
   - Await written approval before implementation
   - Archive approval email with adjustment documentation

**Timeline:** Total process takes 3-5 business days

**Backup Contact:** Marcus Thompson (Risk Analytics, x4589)
- Familiar with model mechanics
- Contact for urgent matters when primary analyst unavailable`,
    rationale: 'Based on your description of the actual $5M+ approval workflow: memo preparation, Risk Committee alignment at weekly sync, then CFO email approval taking 3-5 business days.',
    status: 'pending',
  },
  {
    id: 'change-5',
    fileName: 'Escalation_Policy.md',
    fileIcon: '\uD83D\uDCC4',
    fileType: 'markdown',
    location: 'Section 6.2',
    issue: 'Overlay removal criteria lacks specific operational details',
    currentCode: `### 6.2 Removal Criteria

An overlay should be removed when:
- Triggering condition has normalized for 2+ consecutive quarters
- Model has been recalibrated to capture the pattern
- Risk Committee approves removal`,
    proposedCode: `### 6.2 Removal Criteria

An overlay should be removed when:
- Triggering condition has normalized for **2 consecutive quarters**
- Cohort performance returns to within 5% of baseline
- Model has been recalibrated to capture the pattern
- CFO sign-off obtained (required for overlays >$2M)

**Operational Process:**
1. Set calendar reminder when overlay is first implemented
2. Review at each quarter-end against original triggering condition
3. Document normalization evidence before removal request
4. Obtain required approvals based on overlay size

**Warning:** Overlays have historically persisted too long. Proactive quarterly
review is mandatory to prevent stale adjustments affecting reserve accuracy.`,
    rationale: 'You mentioned removal requires 2 consecutive quarters of normalization, CFO sign-off, and that you use calendar reminders because overlays have persisted too long in the past.',
    status: 'pending',
  },
];

// Revised proposal after context is added (for change-4)
const REVISED_PROPOSAL_CODE = `### 4.3 Major Adjustments (>$5M impact)

- Requires CFO formal approval via email
- Risk Committee must be informed in advance
- Board notification required for adjustments >$10M

**Standard Approval Workflow (3-5 business days):**

1. **Prepare Memo** - Include 1-page executive summary + detailed analysis
2. **Risk Committee Alignment** - Present at weekly sync meeting
3. **CFO Formal Approval** - Send via email, await written approval

**Expedited Workflow for Urgent Situations:**

When weekly sync is too far out:
1. Email memo to all Risk Committee members
2. Subject line: "URGENT REVIEW - [adjustment description]"
3. Request async approval within 24 hours
4. Proceed to CFO once committee confirms via email

**Timeline:** Standard 3-5 days, Expedited 1-2 days

**Backup Contact:** Marcus Thompson (Risk Analytics, x4589)`;

// Mock memo content
const GENERATED_MEMO = {
  title: 'Credit Loss Overlay Process - Knowledge Transfer Memo',
  sections: [
    {
      heading: 'Overview',
      content: 'This memo documents the tribal knowledge captured from Alice Chen regarding the credit loss overlay process. It covers decision criteria, thresholds, and approval workflows that were previously undocumented.',
    },
    {
      heading: 'Key Decision Points',
      content: '1. Overlay triggers: 15% MoM increase in 30-day delinquency, or 25% cohort variance for 2+ months\n2. Adjustment formula: 1% loss forecast per 10% delinquency increase (capped at 5%)\n3. New product buffer: 20% for products under 6 months old',
    },
    {
      heading: 'Approval Thresholds',
      content: '\u2022 Under $2M impact: Analyst discretion with documentation\n\u2022 $2M - $5M impact: CFO approval via email\n\u2022 Over $5M impact: Memo + Risk Committee alignment + CFO formal approval (3-5 business days)',
    },
    {
      heading: 'Backup & Escalation',
      content: 'Primary backup: Marcus (Risk Analytics) - familiar with model but needs training on overlay decisions. For urgent matters during transition, escalate to CFO directly.',
    },
  ],
};

// Scripted agent responses for demo - with source citations as links
// Source types for rendering
interface SourceLink {
  type: 'file' | 'conversation' | 'memo';
  name: string;
  detail: string;
}

// Parse and render message with source links
function renderMessageWithSources(content: string): React.ReactNode {
  // Check if message has sources section
  const sourcesMatch = content.match(/Sources:\s*([\s\S]+)$/);
  if (!sourcesMatch) {
    return <p className="text-sm whitespace-pre-line">{content}</p>;
  }

  const mainContent = content.replace(/Sources:\s*([\s\S]+)$/, '').trim();
  const sourcesText = sourcesMatch[1];

  // Parse source links: [[type:name|detail]]
  const sourcePattern = /\[\[source:([^|]+)\|([^\]]+)\]\]/g;
  const sources: SourceLink[] = [];
  let match;
  while ((match = sourcePattern.exec(sourcesText)) !== null) {
    const name = match[1];
    const detail = match[2];
    let type: 'file' | 'conversation' | 'memo' = 'file';
    if (name === 'Conversation') type = 'conversation';
    else if (name === 'Knowledge Memo') type = 'memo';
    sources.push({ type, name, detail });
  }

  return (
    <div>
      <p className="text-sm whitespace-pre-line">{mainContent}</p>
      {sources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gg-border">
          <p className="text-xs text-gg-muted mb-2">Sources</p>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((source, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gg-accent/10 text-gg-accent-light text-xs rounded-md hover:bg-gg-accent/20 cursor-pointer transition-colors"
              >
                {source.type === 'file' && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                {source.type === 'conversation' && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                )}
                {source.type === 'memo' && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                )}
                <span className="font-medium">{source.type === 'conversation' ? source.detail : source.name}</span>
                {source.type === 'file' && <span className="text-gg-accent-light/70">{source.detail}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const AGENT_RESPONSES: Record<string, string> = {
  'default': "I'm Alice's knowledge agent, trained on her documented expertise. I can help answer questions about the credit loss overlay process, thresholds, and approval workflows. What would you like to know?",
  'threshold': `Based on Alice's documentation, the actual thresholds are:

Subprime: 18% loss rate
Deep subprime: 28% loss rate

These aren't hardcoded because they change quarterly based on portfolio composition. You'll want to recalculate them at quarter-end, especially after marketing campaigns or market entry/exit events.

Sources:
[[source:threshold_config.py|Lines 23-41]]
[[source:Conversation|Threshold Calibration]]`,

  'overlay': `Alice applies overlays when she sees early delinquency signals the model hasn't caught.

Trigger Conditions:
- 15% MoM increase in 30-day delinquency rates
- 25% variance from model forecast for 2+ consecutive months

Adjustment Calculation:
Every 10% increase in early delinquencies adds 1% to loss forecast (capped at 5%)

Sources:
[[source:Conversation|Decision Triggers]]
[[source:loss_model.py|Lines 48-67]]
[[source:Knowledge Memo|Key Decision Points]]`,

  'approval': `Here's the complete approval workflow:

Under $2M: Proceed with documentation, no pre-approval needed
$2M - $5M: CFO approval via email required
Over $5M: Full approval process required

For >$5M adjustments:
1. Prepare memo with executive summary + data
2. Present at weekly Risk Committee sync
3. Get CFO formal approval via email
4. Timeline: 3-5 business days (1-2 days if expedited)

Expedited process available when weekly sync is too far out - email committee for async 24-hour approval.

Sources:
[[source:Escalation_Policy.md|Section 4.3]]
[[source:Conversation|Approval Workflow]]
[[source:threshold_config.py|Lines 12-18]]`,

  'backup': `Primary Backup: Marcus Thompson (Risk Analytics, ext. 4589)

Marcus knows the model architecture well but hasn't made overlay decisions independently. For his first few overlays, recommend he:
1. Document his reasoning thoroughly
2. Review with Risk Committee before implementing
3. Start with smaller adjustments (<$2M)

Urgent Escalation: Contact CFO directly for time-sensitive matters.

Sources:
[[source:Escalation_Policy.md|Section 9]]
[[source:Conversation|Backup & Handoff]]
[[source:Knowledge Memo|Backup & Escalation]]`,

  'removal': `Overlay Removal Criteria:

1. Triggering condition must normalize for 2+ consecutive quarters
2. CFO sign-off required before removal
3. Document removal rationale in adjustment log

Important: Alice noted that overlays have historically persisted too long. She set up quarterly calendar reminders to proactively review all active overlays. Continue this practice to prevent stale adjustments.

Sources:
[[source:Escalation_Policy.md|Section 6]]
[[source:Conversation|Removal Process]]`,

  'delinquency': `Based on the patterns you're describing, here's what I'd recommend:

Immediate Assessment:
1. Check if the variance exceeds 25% from model forecast
2. Review 30-day delinquency trends - is there a 15%+ MoM increase?
3. Compare against the segment threshold (near-prime: 7%)

If Overlay Is Warranted:
- Calculate adjustment: 1% per 10% delinquency increase (max 5%)
- Document rationale with cohort data
- If impact is $2M-$5M, get CFO email approval
- If impact >$5M, schedule Risk Committee discussion

Key Question: Is this a temporary blip or sustained pattern? Alice recommended waiting for 2 months of data before implementing overlays for new patterns.

Sources:
[[source:Conversation|Decision Triggers]]
[[source:threshold_config.py|Lines 23-41]]
[[source:Escalation_Policy.md|Section 4]]
[[source:Q3_Loss_Forecast.xlsx|Sheet: Adjustments]]`,
};

function getAgentResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase();

  // Demo scenario: Manager asking about unusual patterns - most comprehensive response
  if ((msg.includes('unusual') || msg.includes('pattern') || msg.includes('seeing') || msg.includes('noticed')) &&
      (msg.includes('delinquency') || msg.includes('segment') || msg.includes('near-prime') || msg.includes('near prime'))) {
    return AGENT_RESPONSES['delinquency'];
  }
  if (msg.includes('threshold') || msg.includes('subprime') || msg.includes('deep_sub') || msg.includes('18%') || msg.includes('28%')) {
    return AGENT_RESPONSES['threshold'];
  }
  if (msg.includes('overlay') || msg.includes('adjust') || msg.includes('trigger')) {
    return AGENT_RESPONSES['overlay'];
  }
  if (msg.includes('approval') || msg.includes('approve') || msg.includes('cfo') || msg.includes('$5m') || msg.includes('escalat') || msg.includes('process')) {
    return AGENT_RESPONSES['approval'];
  }
  if (msg.includes('backup') || msg.includes('marcus') || msg.includes('who') || msg.includes('contact') || msg.includes('urgent')) {
    return AGENT_RESPONSES['backup'];
  }
  if (msg.includes('remov') || msg.includes('stop') || msg.includes('end') || msg.includes('when to')) {
    return AGENT_RESPONSES['removal'];
  }
  if (msg.includes('delinquency') || msg.includes('when')) {
    return AGENT_RESPONSES['overlay'];
  }

  return AGENT_RESPONSES['default'];
}

export function HandoffStep() {
  const { setStep } = useOffboarding();
  const [phase, setPhase] = useState<Phase>('documents');
  const [changes, setChanges] = useState<ProposedChange[]>(PROPOSED_CHANGES);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [showContextInput, setShowContextInput] = useState(false);
  const [contextInput, setContextInput] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [memoProgress, setMemoProgress] = useState(0);
  const [memoGenerated, setMemoGenerated] = useState(false);
  const [memoSections, setMemoSections] = useState(GENERATED_MEMO.sections);
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [memoMessages, setMemoMessages] = useState<ChatMessage[]>([]);
  const [memoInput, setMemoInput] = useState('');
  const [isMemoTyping, setIsMemoTyping] = useState(false);
  const [agentProgress, setAgentProgress] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const memoMessagesEndRef = useRef<HTMLDivElement>(null);
  const memoCharIndexRef = useRef(0);
  const agentCharIndexRef = useRef(0);
  const contextCharIndexRef = useRef(0);
  const memoInputRef = useRef<HTMLInputElement>(null);
  const contextInputRef = useRef<HTMLTextAreaElement>(null);

  // Scripted texts for demo
  const MEMO_SCRIPTED_TEXT = 'write a section that briefly explains the relationship between artifacts';
  const AGENT_SCRIPTED_TEXT = 'We observe unusual delinquency';
  const CONTEXT_SCRIPTED_TEXT = 'For urgent cases, expedite the review process by sending an email to expeditereview@company.com with the title "URGENT REVIEW". Include a one-page reasoning.';

  const currentChange = changes[currentChangeIndex];
  const allChangesReviewed = changes.every(c => c.status !== 'pending');
  const acceptedChanges = changes.filter(c => c.status === 'accepted');
  const acceptedCount = acceptedChanges.length;

  // Group accepted changes by document
  const groupedByDoc = acceptedChanges.reduce((acc, change) => {
    if (!acc[change.fileName]) {
      acc[change.fileName] = { icon: change.fileIcon, changes: [] };
    }
    acc[change.fileName].changes.push(change);
    return acc;
  }, {} as Record<string, { icon: string; changes: typeof acceptedChanges }>);
  const enhancedDocCount = Object.keys(groupedByDoc).length;

  const toggleDocExpand = (docName: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docName)) {
        next.delete(docName);
      } else {
        next.add(docName);
      }
      return next;
    });
  };

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-scroll memo messages
  useEffect(() => {
    memoMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [memoMessages]);

  // Memo generation animation
  useEffect(() => {
    if (phase === 'memo' && !memoGenerated) {
      const interval = setInterval(() => {
        setMemoProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setMemoGenerated(true);
              setMemoMessages([{
                id: 'memo-initial',
                role: 'agent',
                content: "I've generated a knowledge transfer memo based on the captured information. You can edit any section directly by clicking on it, or ask me to make changes. What would you like to adjust?",
                timestamp: Date.now(),
              }]);
            }, 500);
            return 100;
          }
          return prev + 4;
        });
      }, 60);
      return () => clearInterval(interval);
    }
  }, [phase, memoGenerated]);

  // Agent creation animation
  useEffect(() => {
    if (phase === 'agent' && !showCelebration) {
      const interval = setInterval(() => {
        setAgentProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setShowCelebration(true);
            }, 500);
            return 100;
          }
          return prev + 3;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [phase, showCelebration]);

  // Celebration to complete transition - calls setStep(6) instead of showing agent chat
  useEffect(() => {
    if (showCelebration) {
      const timer = setTimeout(() => {
        setStep(5);
      }, 4000); // Show celebration for 4 seconds, then move to CompleteStep
      return () => clearTimeout(timer);
    }
  }, [showCelebration, setStep]);

  const handleAction = (action: ReviewAction) => {
    if (action === 'context') {
      setShowContextInput(true);
      return;
    }

    const updatedChanges = [...changes];
    updatedChanges[currentChangeIndex] = {
      ...updatedChanges[currentChangeIndex],
      status: action,
    };
    setChanges(updatedChanges);

    // Move to next change or finish
    if (currentChangeIndex < changes.length - 1) {
      setCurrentChangeIndex(currentChangeIndex + 1);
    }
  };

  const handleContextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // For any printable character, add one character from the scripted text
    if (e.key.length === 1) {
      e.preventDefault();
      if (contextCharIndexRef.current < CONTEXT_SCRIPTED_TEXT.length) {
        contextCharIndexRef.current++;
        setContextInput(CONTEXT_SCRIPTED_TEXT.slice(0, contextCharIndexRef.current));
        // Scroll textarea to show latest text
        requestAnimationFrame(() => {
          if (contextInputRef.current) {
            contextInputRef.current.scrollTop = contextInputRef.current.scrollHeight;
          }
        });
      }
    }
  };

  const handleSubmitContext = () => {
    setShowContextInput(false);
    setIsRevising(true);
    contextCharIndexRef.current = 0;

    // Simulate AI thinking and revising the proposal
    setTimeout(() => {
      setIsRevising(false);

      // Update the change with revised proposal
      const updatedChanges = [...changes];
      updatedChanges[currentChangeIndex] = {
        ...updatedChanges[currentChangeIndex],
        additionalContext: contextInput,
        proposedCode: REVISED_PROPOSAL_CODE,
        rationale: 'Revised: Added expedited workflow for urgent situations based on your feedback.',
      };
      setChanges(updatedChanges);
      setContextInput('');
    }, 2000);
  };

  const handleContinueToMemo = () => {
    setPhase('memo');
  };

  const handleContinueToAgent = () => {
    setPhase('agent');
  };

  const handleMemoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Send on Enter
    if (e.key === 'Enter') {
      if (memoInput.trim()) {
        handleMemoSendMessage();
      }
      return;
    }

    // For any printable character, add one character from the scripted text
    if (!isMemoTyping && e.key.length === 1) {
      e.preventDefault();
      if (memoCharIndexRef.current < MEMO_SCRIPTED_TEXT.length) {
        memoCharIndexRef.current++;
        setMemoInput(MEMO_SCRIPTED_TEXT.slice(0, memoCharIndexRef.current));
        // Scroll input to show latest text
        requestAnimationFrame(() => {
          if (memoInputRef.current) {
            memoInputRef.current.scrollLeft = memoInputRef.current.scrollWidth;
          }
        });
      }
    }
  };

  const handleMemoSendMessage = () => {
    if (!memoInput.trim() || isMemoTyping) return;

    const userMessage: ChatMessage = {
      id: `memo-user-${Date.now()}`,
      role: 'user',
      content: memoInput.trim(),
      timestamp: Date.now(),
    };

    setMemoMessages(prev => [...prev, userMessage]);
    const userInput = memoInput.trim().toLowerCase();
    setMemoInput('');
    memoCharIndexRef.current = 0;
    setIsMemoTyping(true);

    // Simulate AI response with memo edits
    setTimeout(() => {
      let response = "I've noted your feedback. You can also click directly on any section to edit it manually. Is there anything else you'd like me to adjust?";

      // Demo: If user asks to write a section about relationship between artifacts
      if ((userInput.includes('write') || userInput.includes('add')) && userInput.includes('section') && (userInput.includes('relationship') || userInput.includes('artifact'))) {
        const newSection = {
          heading: 'Artifact Relationships',
          content: `\u2022 Q3_Loss_Forecast.xlsx: Contains model predictions with documented overlay adjustments in cells D14:D18
\u2022 loss_model.py: Generates base loss predictions with overlay decision logic now implemented
\u2022 Escalation_Policy.md: Documents approval workflows and thresholds for all adjustment sizes
\u2022 threshold_config.py: Defines segment thresholds and escalation rules referenced by the model

Data flows from model output \u2192 Excel adjustments \u2192 policy documentation. All overlays must reference the escalation policy for approval requirements.`,
        };
        setMemoSections(prev => [...prev, newSection]);
        response = "Section added! Let me know if you want further changes.";
      }
      // Demo: If user mentions "add" or "include" something about contacts
      else if (userInput.includes('add') && (userInput.includes('contact') || userInput.includes('email') || userInput.includes('phone'))) {
        const updatedSections = [...memoSections];
        updatedSections[3] = {
          ...updatedSections[3],
          content: updatedSections[3].content + '\n\nContact Information:\n\u2022 Alice Chen: alice.chen@company.com (available for questions until end of month)\n\u2022 Marcus Thompson: marcus.t@company.com, ext. 4589',
        };
        setMemoSections(updatedSections);
        response = "Done! I've added contact information to the Backup & Escalation section. The memo now includes email addresses for both Alice and Marcus.";
      }
      // Demo: If user mentions simplify or shorter
      else if (userInput.includes('simplif') || userInput.includes('shorter') || userInput.includes('concise')) {
        response = "I can simplify any section. Which section would you like me to make more concise - Overview, Key Decision Points, Approval Thresholds, or Backup & Escalation?";
      }

      const agentMessage: ChatMessage = {
        id: `memo-agent-${Date.now()}`,
        role: 'agent',
        content: response,
        timestamp: Date.now(),
      };
      setMemoMessages(prev => [...prev, agentMessage]);
      setIsMemoTyping(false);
    }, 1000);
  };

  const handleSectionEdit = (index: number, newContent: string) => {
    const updatedSections = [...memoSections];
    updatedSections[index] = { ...updatedSections[index], content: newContent };
    setMemoSections(updatedSections);
  };

  const handleAgentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Send on Enter
    if (e.key === 'Enter') {
      if (inputValue.trim()) {
        handleSendMessage();
      }
      return;
    }

    // For any printable character, add one character from the scripted text
    if (!isTyping && e.key.length === 1) {
      e.preventDefault();
      if (agentCharIndexRef.current < AGENT_SCRIPTED_TEXT.length) {
        agentCharIndexRef.current++;
        setInputValue(AGENT_SCRIPTED_TEXT.slice(0, agentCharIndexRef.current));
      }
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    agentCharIndexRef.current = 0;
    setIsTyping(true);

    setTimeout(() => {
      const agentMessage: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: getAgentResponse(userMessage.content),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, agentMessage]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="h-full bg-gg-bg flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gg-card border-b border-gg-border px-6 py-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gg-rust flex items-center justify-center">
              <span className="text-white font-semibold">B</span>
            </div>
            <div>
              <h1 className="font-semibold text-gg-text">Bridge AI</h1>
              <p className="text-sm text-gg-secondary">Knowledge Handoff</p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-6">
            <StepIndicator step={1} label="Documents" isActive={phase === 'documents'} isComplete={phase !== 'documents'} />
            <div className="w-8 h-px bg-gg-border" />
            <StepIndicator step={2} label="Memo" isActive={phase === 'memo'} isComplete={phase === 'agent' || phase === 'complete'} />
            <div className="w-8 h-px bg-gg-border" />
            <StepIndicator step={3} label="Agent" isActive={phase === 'agent' || phase === 'complete'} isComplete={phase === 'complete'} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-6xl w-full mx-auto px-6 py-6">
        {/* Document Enhancement Phase */}
        {phase === 'documents' && (
          <div className="animate-fadeIn h-full flex flex-col">
            <div className="mb-4 flex-shrink-0">
              <h2 className="text-xl font-bold text-gg-text mb-2">
                Review Proposed Document Changes
              </h2>
              <p className="text-gg-secondary text-sm">
                Based on your captured knowledge, Bridge AI proposes the following documentation enhancements.
              </p>
            </div>

            {/* Progress bar */}
            <div className="mb-4 flex-shrink-0">
              <div className="flex items-center justify-between text-sm text-gg-secondary mb-2">
                <span>Reviewing change {currentChangeIndex + 1} of {changes.length}</span>
                <span>{acceptedCount} accepted</span>
              </div>
              <div className="h-2 bg-gg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gg-accent transition-all duration-300"
                  style={{ width: `${((currentChangeIndex + (allChangesReviewed ? 1 : 0)) / changes.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Revising state - AI thinking */}
            {isRevising && (
              <div className="bg-gg-card rounded-xl border border-gg-border p-8">
                <div className="flex items-center justify-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-gg-accent/30 border-t-gg-accent animate-spin"></div>
                  </div>
                  <div>
                    <p className="font-semibold text-gg-text">Revising proposal...</p>
                    <p className="text-sm text-gg-secondary">Incorporating your additional context</p>
                  </div>
                </div>
              </div>
            )}

            {/* Current change card */}
            {!allChangesReviewed && currentChange && !isRevising && (
              <div className={`bg-gg-card rounded-xl border overflow-hidden flex flex-col flex-1 min-h-0 ${currentChange.additionalContext ? 'border-gg-accent border-2' : 'border-gg-border'}`}>
                {/* Change header */}
                <div className={`px-6 py-4 border-b flex items-center justify-between ${currentChange.additionalContext ? 'bg-gg-accent/10 border-gg-accent/20' : 'border-gg-border'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{currentChange.fileIcon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gg-text">{currentChange.fileName}</h3>
                        {currentChange.additionalContext && (
                          <span className="px-2 py-0.5 bg-gg-accent text-white text-xs font-medium rounded-full">
                            Revised
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gg-secondary">{currentChange.location}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-amber-900/30 text-amber-400 text-sm font-medium rounded-full">
                    {currentChange.issue}
                  </span>
                </div>

                {/* Diff view */}
                <div className="grid grid-cols-2 divide-x divide-gg-border flex-1 min-h-0 overflow-hidden">
                  {/* Current */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-3 h-3 rounded-full bg-red-400"></span>
                      <span className="text-sm font-medium text-gg-secondary">Current</span>
                    </div>
                    <pre className="text-xs bg-red-900/20 border border-red-500/20 rounded-lg p-4 whitespace-pre-wrap text-red-300 font-mono">
                      {currentChange.currentCode}
                    </pre>
                  </div>

                  {/* Proposed */}
                  <div className="p-4 overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-3 h-3 rounded-full bg-green-400"></span>
                      <span className="text-sm font-medium text-gg-secondary">Proposed</span>
                    </div>
                    <pre className="text-xs bg-green-900/20 border border-green-500/20 rounded-lg p-4 whitespace-pre-wrap text-green-300 font-mono overflow-auto max-h-full">
                      {currentChange.proposedCode}
                    </pre>
                  </div>
                </div>

                {/* Rationale */}
                <div className="px-6 py-4 bg-gg-accent/10 border-t border-gg-accent/20">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-gg-accent-light flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gg-accent-light">Why this change?</p>
                      <p className="text-sm text-gg-accent-light/80 mt-1">{currentChange.rationale}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t border-gg-border">
                  {!showContextInput ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleAction('accepted')}
                        className="flex-1 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Accept
                      </button>
                      <button
                        onClick={() => handleAction('declined')}
                        className="flex-1 px-4 py-2.5 bg-gg-surface text-gg-secondary font-medium rounded-lg hover:bg-gg-card transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Decline
                      </button>
                      <button
                        onClick={() => handleAction('context')}
                        className="flex-1 px-4 py-2.5 bg-gg-accent/10 text-gg-accent-light font-medium rounded-lg hover:bg-gg-accent/20 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        Add Context
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gg-secondary">
                        What additional context should be included?
                      </label>
                      <textarea
                        ref={contextInputRef}
                        value={contextInput}
                        onChange={(e) => setContextInput(e.target.value)}
                        onKeyDown={handleContextKeyDown}
                        className="w-full px-4 py-3 bg-gg-surface border border-gg-border rounded-lg text-sm text-gg-text focus:outline-none focus:ring-2 focus:ring-gg-accent focus:ring-offset-gg-bg"
                        rows={3}
                        placeholder="Add details the AI might have missed..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSubmitContext}
                          disabled={!contextInput.trim()}
                          className="px-4 py-2 bg-gg-accent text-white font-medium rounded-lg hover:bg-gg-accent/90 disabled:opacity-50 transition-colors"
                        >
                          Submit
                        </button>
                        <button
                          onClick={() => {
                            setShowContextInput(false);
                            setContextInput('');
                            contextCharIndexRef.current = 0;
                          }}
                          className="px-4 py-2 bg-gg-surface text-gg-secondary font-medium rounded-lg hover:bg-gg-card transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* All reviewed - show summary */}
            {allChangesReviewed && (
              <div className="bg-gg-card rounded-xl border border-gg-border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-green-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gg-text">Review Complete</h3>
                    <p className="text-sm text-gg-secondary">
                      {acceptedCount} of {changes.length} changes accepted
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  {changes.map((change) => (
                    <div key={change.id} className="flex items-center justify-between py-2 px-3 bg-gg-surface rounded-lg">
                      <div className="flex items-center gap-2">
                        <span>{change.fileIcon}</span>
                        <span className="text-sm text-gg-text">{change.fileName}</span>
                        <span className="text-xs text-gg-muted">({change.location})</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        change.status === 'accepted' ? 'bg-green-900/30 text-green-400' :
                        change.status === 'declined' ? 'bg-gg-surface text-gg-muted' :
                        'bg-gg-accent/10 text-gg-accent-light'
                      }`}>
                        {change.status === 'accepted' ? 'Accepted' :
                         change.status === 'declined' ? 'Declined' : 'Context Added'}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleContinueToMemo}
                  className="w-full px-4 py-3 bg-gg-accent text-white font-medium rounded-lg hover:bg-gg-accent/90 transition-colors"
                >
                  Continue to Memo Generation
                </button>
              </div>
            )}
          </div>
        )}

        {/* Memo Generation Phase */}
        {phase === 'memo' && (
          <div className="animate-fadeIn h-full flex flex-col">
            {/* Loading state */}
            {!memoGenerated && (
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-gg-card rounded-xl border border-gg-border p-8 text-center max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gg-accent/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gg-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gg-text mb-2">Generating Knowledge Memo</h2>
                  <p className="text-gg-secondary mb-6">Creating comprehensive workflow documentation...</p>
                  <div className="h-3 bg-gg-border rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-gg-accent transition-all duration-100 rounded-full"
                      style={{ width: `${memoProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gg-muted">{memoProgress}% complete</p>
                </div>
              </div>
            )}

            {/* Review state */}
            {memoGenerated && (
              <div className="flex gap-6 h-full min-h-0">
                {/* Left: Memo Preview */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="mb-4 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gg-text mb-1">Review Knowledge Memo</h2>
                    <p className="text-gg-secondary text-sm">Click on any section to edit directly, or use the chat to request changes.</p>
                  </div>

                  <div className="bg-gg-card rounded-xl border border-gg-border flex-1 min-h-0 overflow-auto">
                    {/* Memo Header */}
                    <div className="px-6 py-4 border-b border-gg-border bg-gg-surface">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gg-accent/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-gg-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gg-text">{GENERATED_MEMO.title}</h3>
                          <p className="text-sm text-gg-secondary">Knowledge Transfer Document</p>
                        </div>
                      </div>
                    </div>

                    {/* Memo Sections */}
                    <div className="p-6 space-y-6">
                      {memoSections.map((section, index) => (
                        <div key={index} className="group">
                          <h4 className="font-semibold text-gg-text mb-2 flex items-center gap-2">
                            {section.heading}
                            {editingSectionIndex !== index && (
                              <button
                                onClick={() => setEditingSectionIndex(index)}
                                className="opacity-0 group-hover:opacity-100 text-gg-accent-light hover:text-gg-accent transition-opacity"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            )}
                          </h4>
                          {editingSectionIndex === index ? (
                            <div className="space-y-2">
                              <textarea
                                value={section.content}
                                onChange={(e) => handleSectionEdit(index, e.target.value)}
                                className="w-full px-3 py-2 bg-gg-surface border border-gg-accent rounded-lg text-sm text-gg-text focus:outline-none focus:ring-2 focus:ring-gg-accent min-h-[100px]"
                                autoFocus
                              />
                              <button
                                onClick={() => setEditingSectionIndex(null)}
                                className="px-3 py-1.5 bg-gg-accent text-white text-sm font-medium rounded-lg hover:bg-gg-accent/90 transition-colors"
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm text-gg-secondary whitespace-pre-line cursor-pointer hover:bg-gg-surface rounded-lg p-2 -m-2 transition-colors" onClick={() => setEditingSectionIndex(index)}>
                              {section.content}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Continue Button */}
                  <div className="mt-4 flex-shrink-0">
                    <button
                      onClick={handleContinueToAgent}
                      className="w-full px-4 py-3 bg-gg-accent text-white font-medium rounded-lg hover:bg-gg-accent/90 transition-colors"
                    >
                      Approve Memo & Continue to Agent
                    </button>
                  </div>
                </div>

                {/* Right: Chat Panel */}
                <div className="w-80 flex flex-col min-h-0 bg-gg-card rounded-xl border border-gg-border">
                  <div className="px-4 py-3 border-b border-gg-border flex-shrink-0">
                    <h3 className="font-semibold text-gg-text text-sm">Chat with Bridge AI</h3>
                    <p className="text-xs text-gg-secondary">Ask for edits or clarifications</p>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
                    {memoMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                            msg.role === 'user'
                              ? 'bg-gg-accent text-white'
                              : 'bg-gg-surface text-gg-text'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isMemoTyping && (
                      <div className="flex justify-start">
                        <div className="bg-gg-surface text-gg-text px-3 py-2 rounded-lg text-sm">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-gg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-gg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-gg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </span>
                        </div>
                      </div>
                    )}
                    <div ref={memoMessagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-3 border-t border-gg-border flex-shrink-0">
                    <div className="flex gap-2">
                      <input
                        ref={memoInputRef}
                        type="text"
                        value={memoInput}
                        onChange={(e) => setMemoInput(e.target.value)}
                        onKeyDown={handleMemoKeyDown}
                        placeholder="Ask for changes..."
                        className="flex-1 px-3 py-2 bg-gg-surface border border-gg-border rounded-lg text-sm text-gg-text focus:outline-none focus:ring-2 focus:ring-gg-accent"
                      />
                      <button
                        onClick={handleMemoSendMessage}
                        disabled={!memoInput.trim() || isMemoTyping}
                        className="px-3 py-2 bg-gg-accent text-white rounded-lg hover:bg-gg-accent/90 disabled:opacity-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agent Creation Phase */}
        {phase === 'agent' && (
          <div className="animate-fadeIn h-full flex flex-col">
            {!showCelebration ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-gg-card rounded-xl border border-gg-border p-8 text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gg-rust/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gg-rust-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gg-text mb-2">Creating Knowledge Agent</h2>
                <p className="text-gg-secondary mb-6">Training AI on Alice's documented expertise...</p>
                <div className="h-3 bg-gg-border rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-gg-rust transition-all duration-100 rounded-full"
                    style={{ width: `${agentProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gg-muted">{agentProgress}% complete</p>
                </div>
              </div>
            ) : (
              /* Celebration Screen */
              <div className="text-center py-8 animate-fadeIn">
                {/* Confetti effect - floating particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute animate-confetti"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: '-20px',
                        animationDelay: `${Math.random() * 2}s`,
                        animationDuration: `${3 + Math.random() * 2}s`,
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: ['#D4A843', '#C0362C', '#10B981', '#E5C06E', '#D4564C', '#F59E0B'][Math.floor(Math.random() * 6)],
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Main celebration content */}
                <div className="relative z-10">
                  {/* Animated checkmark with glow */}
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-25"></div>
                    <div className="relative w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-900/30">
                      <svg className="w-12 h-12 text-white animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Celebration text */}
                  <h1 className="text-3xl font-bold text-gg-text mb-3">
                    You're all set, Alice! 🎉
                  </h1>

                  <p className="text-lg text-gg-secondary mb-6 max-w-md mx-auto">
                    Your knowledge has been captured and preserved for the team.
                  </p>

                  {/* Stats cards */}
                  <div className="flex justify-center gap-4 mb-8">
                    <div className="bg-gg-card rounded-xl border border-gg-border px-6 py-4 shadow-sm">
                      <div className="text-2xl font-bold text-gg-accent-light">{acceptedCount}</div>
                      <div className="text-sm text-gg-secondary">Docs Enhanced</div>
                    </div>
                    <div className="bg-gg-card rounded-xl border border-gg-border px-6 py-4 shadow-sm">
                      <div className="text-2xl font-bold text-gg-rust-light">1</div>
                      <div className="text-sm text-gg-secondary">AI Agent Created</div>
                    </div>
                    <div className="bg-gg-card rounded-xl border border-gg-border px-6 py-4 shadow-sm">
                      <div className="text-2xl font-bold text-green-400">{memoSections.length}</div>
                      <div className="text-sm text-gg-secondary">Memo Sections</div>
                    </div>
                  </div>

                  {/* Thank you message */}
                  <div className="bg-gg-rust/10 rounded-xl p-6 max-w-lg mx-auto border border-gg-rust/20">
                    <p className="text-gg-secondary leading-relaxed">
                      Thank you for your dedication and all your contributions to the Risk Analytics team.
                      Your expertise will continue to guide your colleagues through your AI agent.
                    </p>
                    <p className="text-gg-accent font-medium mt-3">
                      Best wishes on your next adventure! 🚀
                    </p>
                  </div>

                  {/* Loading indicator for transition */}
                  <p className="text-sm text-gg-muted mt-6 animate-pulse">
                    Preparing your deliverables...
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Step Indicator Component
function StepIndicator({ step, label, isActive, isComplete }: {
  step: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
        isComplete ? 'bg-green-900/30 text-green-400' :
        isActive ? 'bg-gg-accent text-white' :
        'bg-gg-surface text-gg-muted'
      }`}>
        {isComplete ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : step}
      </div>
      <span className={`text-sm ${isActive || isComplete ? 'text-gg-text font-medium' : 'text-gg-muted'}`}>
        {label}
      </span>
    </div>
  );
}
