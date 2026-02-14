import { NextRequest, NextResponse } from 'next/server';
import { Artifact, ArtifactGap } from '@/types/api';

// Mock analysis results based on the artifacts we created
// In production, this would be replaced with actual Claude API calls
const MOCK_GAPS: ArtifactGap[] = [
  {
    id: 'gap-1',
    artifactId: 'artifact-loss_model',
    artifactName: 'loss_model.py',
    location: 'Lines 48-49',
    issue: 'TODO comment indicates manual overlay logic is not implemented. The decision process exists only in the analyst\'s head.',
    severity: 'high',
    category: 'logic',
    suggestedQuestion: 'The model code has a gap at lines 48-49 where the overlay decision should be made. Can you describe the mental process you use to decide when and how much to adjust?',
    followUpQuestion: 'Are there any edge cases or exceptions to this logic that someone else should know about?'
  },
  {
    id: 'gap-2',
    artifactId: 'artifact-threshold_config',
    artifactName: 'threshold_config.py',
    location: 'Lines 19-20, 23',
    issue: 'Threshold configuration has placeholder values for subprime (marked with ???) and no threshold for deep_subprime. Comment explicitly states "Alice knows the real thresholds".',
    severity: 'high',
    category: 'documentation',
    suggestedQuestion: 'The threshold config shows subprime has a placeholder value and deep_subprime has no threshold at all. What are the actual thresholds you use, and why aren\'t they in the code?',
    followUpQuestion: 'How often do these thresholds change, and what triggers a change?'
  },
  {
    id: 'gap-3',
    artifactId: 'artifact-Q3_Loss_Forecast',
    artifactName: 'Q3_Loss_Forecast.json',
    location: 'Summary sheet, cells C14:C16',
    issue: 'Manual adjustments (+1.2% to +4.5%) override model outputs with only vague comments like "Adjustment based on early delinquency signals" - no documented rationale or criteria.',
    severity: 'high',
    category: 'data',
    suggestedQuestion: 'I found manual adjustment values in cells C14:C16 that override the model calculations. These add 1.2% to 4.5% to the loss forecasts. When do you decide to apply these manual overlays?',
    followUpQuestion: 'What specific indicators or thresholds tell you how much to adjust by?'
  },
  {
    id: 'gap-4',
    artifactId: 'artifact-Q3_Loss_Forecast',
    artifactName: 'Q3_Loss_Forecast.json',
    location: 'Adjustment_Log sheet, column E',
    issue: 'Approval column is consistently empty across all adjustment entries - governance gap in tracking who approved changes.',
    severity: 'medium',
    category: 'process',
    suggestedQuestion: 'The adjustment log shows approvals are not being tracked. What is the actual approval process you follow before applying an overlay?',
    followUpQuestion: 'Who has authority to approve different sizes of adjustments?'
  },
  {
    id: 'gap-5',
    artifactId: 'artifact-Segment_Analysis',
    artifactName: 'Segment_Analysis.json',
    location: 'Cohort_Performance sheet',
    issue: 'Q1-24 cohorts show 32-38% variance from expected loss rates with "REVIEW" status, but no documentation of how this data informs overlay decisions.',
    severity: 'medium',
    category: 'logic',
    suggestedQuestion: 'The Q1-24 cohorts show 32-38% variance from expected loss rates. How do you use this cohort data to inform your overlay decisions?',
    followUpQuestion: 'At what variance level do you typically start considering an overlay?'
  },
  {
    id: 'gap-6',
    artifactId: 'artifact-Segment_Analysis',
    artifactName: 'Segment_Analysis.json',
    location: 'Overlay_Tracking sheet',
    issue: 'Deep subprime overlay (+4.5%) has been in place for 6+ months. Notes question whether removal should be reviewed, but no clear removal criteria documented.',
    severity: 'medium',
    category: 'process',
    suggestedQuestion: 'The deep subprime overlay has been in place for over 6 months. What conditions need to be met before an overlay can be removed?',
    followUpQuestion: 'How do you track and review existing overlays to prevent them from becoming stale?'
  },
  {
    id: 'gap-7',
    artifactId: 'artifact-Risk_Committee_Notes',
    artifactName: 'Risk_Committee_Notes.md',
    location: 'Agenda Item 3',
    issue: 'Notes mention "judgment adjustments" and reference "internal documentation" for methodology, but the actual methodology is not documented in the notes.',
    severity: 'medium',
    category: 'documentation',
    suggestedQuestion: 'The committee notes reference "judgment adjustments" but don\'t explain the methodology. What triggers a decision to use an overlay vs. trusting the model output?',
    followUpQuestion: 'How do you present overlay recommendations to the Risk Committee?'
  },
  {
    id: 'gap-8',
    artifactId: 'artifact-Escalation_Policy',
    artifactName: 'Escalation_Policy.md',
    location: 'Section 4.3',
    issue: 'Policy explicitly states "see Alice Chen for the specific approval workflow" for adjustments exceeding $5M - clear tribal knowledge dependency.',
    severity: 'high',
    category: 'process',
    suggestedQuestion: 'The escalation policy references you by name for adjustments over $5M. What\'s the actual approval workflow that you follow?',
    followUpQuestion: 'Who should handle these escalations when you\'re not available?'
  },
  {
    id: 'gap-9',
    artifactId: 'artifact-Segment_Analysis',
    artifactName: 'Segment_Analysis.json',
    location: 'Decision_Matrix sheet',
    issue: 'Decision matrix is marked as "DRAFT, needs documentation" with multiple entries saying "Ask Alice" for criteria details.',
    severity: 'high',
    category: 'documentation',
    suggestedQuestion: 'The decision matrix for when to apply overlays is incomplete and references asking you directly. Can you walk through your complete decision criteria?',
    followUpQuestion: 'What macro indicators do you monitor and what thresholds trigger concern?'
  },
  {
    id: 'gap-10',
    artifactId: 'artifact-threshold_config',
    artifactName: 'threshold_config.py',
    location: 'OVERLAY_CAPS dictionary',
    issue: 'Overlay cap for deep_subprime is set to None with no documented maximum - analyst has unconstrained discretion.',
    severity: 'medium',
    category: 'logic',
    suggestedQuestion: 'The overlay cap for deep subprime is undefined. Is there effectively no limit, or do you apply an informal cap?',
    followUpQuestion: 'What\'s the largest overlay you\'ve ever applied and what circumstances warranted it?'
  }
];

function analyzeArtifacts(artifacts: Artifact[]): ArtifactGap[] {
  // Filter gaps to only include those for artifacts that were actually provided
  const artifactNames = artifacts.map(a => a.name);

  return MOCK_GAPS.filter(gap => {
    // Match by artifact name (handle both exact and partial matches)
    return artifactNames.some(name =>
      gap.artifactName.includes(name.replace('.json', '')) ||
      name.includes(gap.artifactName.replace('.json', ''))
    );
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { artifacts } = body;

    if (!artifacts || !Array.isArray(artifacts)) {
      return NextResponse.json(
        { error: 'artifacts array is required' },
        { status: 400 }
      );
    }

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Get relevant gaps based on provided artifacts
    const gaps = analyzeArtifacts(artifacts);

    // Calculate summary
    const summary = {
      totalGaps: gaps.length,
      highSeverity: gaps.filter(g => g.severity === 'high').length,
      mediumSeverity: gaps.filter(g => g.severity === 'medium').length,
      lowSeverity: gaps.filter(g => g.severity === 'low').length,
      byCategory: {
        documentation: gaps.filter(g => g.category === 'documentation').length,
        logic: gaps.filter(g => g.category === 'logic').length,
        process: gaps.filter(g => g.category === 'process').length,
        data: gaps.filter(g => g.category === 'data').length
      }
    };

    return NextResponse.json({
      gaps,
      summary,
      analyzedAt: new Date().toISOString(),
      mode: 'mock' // Indicate this is mock mode
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze artifacts', details: String(error) },
      { status: 500 }
    );
  }
}
