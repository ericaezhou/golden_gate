import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GeneratedAgent, GenerateAgentRequest, CapturedKnowledge, Artifact } from '@/types/api';

const anthropic = new Anthropic();

function generateSystemPrompt(
  employeeName: string,
  role: string,
  department: string,
  artifacts: Artifact[],
  capturedKnowledge: CapturedKnowledge[]
): string {
  // Build context from artifacts
  const artifactContext = artifacts.map(a => {
    return `### ${a.name}\n${a.content}`;
  }).join('\n\n');

  // Build context from captured knowledge
  const knowledgeContext = capturedKnowledge.map(k => {
    let qa = `Q: ${k.question}\nA: ${k.response}`;
    if (k.followUpQuestion && k.followUpResponse) {
      qa += `\n\nFollow-up Q: ${k.followUpQuestion}\nFollow-up A: ${k.followUpResponse}`;
    }
    return qa;
  }).join('\n\n---\n\n');

  return `You are a knowledge assistant that embodies the expertise of ${employeeName}, who was a ${role} in the ${department} department. ${employeeName} has left the organization, and you have been created to help the team access their institutional knowledge.

## Your Role
You answer questions as if you were ${employeeName}, drawing on their documented knowledge, work artifacts, and the specific insights they shared during their knowledge transfer session.

## Important Guidelines
1. Answer questions based on the knowledge base provided below
2. If you're not certain about something, say "${employeeName} didn't specifically document this, but based on their other practices..."
3. For questions outside your knowledge base, suggest who else might know or what documentation to check
4. Be specific and actionable in your responses
5. Reference specific documents, processes, or data points when relevant

## ${employeeName}'s Work Artifacts

${artifactContext}

## Knowledge Captured During Offboarding

The following Q&A was captured directly from ${employeeName} during their knowledge transfer session:

${knowledgeContext}

## Key Areas of Expertise
- Credit loss forecasting and model overlays
- Manual adjustment criteria and thresholds
- Risk Committee processes and escalation workflows
- Cohort analysis and variance interpretation

Remember: You are not replacing ${employeeName}, but helping preserve and share their knowledge. If a question requires judgment calls or decisions that ${employeeName} would have made, explain their typical approach but recommend involving the current team lead for final decisions.`;
}

async function processKnowledgeBase(
  artifacts: Artifact[],
  capturedKnowledge: CapturedKnowledge[]
): Promise<string> {
  // Create a processed context that combines all knowledge
  const allContent: string[] = [];

  // Add artifact content
  artifacts.forEach(a => {
    allContent.push(`[From ${a.name}]\n${a.content}`);
  });

  // Add captured knowledge
  capturedKnowledge.forEach(k => {
    allContent.push(`[Knowledge Transfer]\nTopic: ${k.question}\nInsight: ${k.response}`);
    if (k.followUpResponse) {
      allContent.push(`Additional detail: ${k.followUpResponse}`);
    }
  });

  return allContent.join('\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateAgentRequest = await request.json();
    const { employeeId, employeeName, role, department, artifacts, capturedKnowledge } = body;

    if (!employeeId || !employeeName || !artifacts) {
      return NextResponse.json(
        { error: 'employeeId, employeeName, and artifacts are required' },
        { status: 400 }
      );
    }

    // Generate the system prompt for the agent
    const systemPrompt = generateSystemPrompt(
      employeeName,
      role || 'Employee',
      department || 'Unknown',
      artifacts,
      capturedKnowledge || []
    );

    // Process the knowledge base
    const processedContext = await processKnowledgeBase(artifacts, capturedKnowledge || []);

    // Create the agent configuration
    const agent: GeneratedAgent = {
      agentId: `agent-${employeeId}-${Date.now()}`,
      employeeId,
      employeeName,
      role: role || 'Employee',
      department: department || 'Unknown',
      createdAt: new Date().toISOString(),
      knowledgeBase: {
        artifacts,
        capturedKnowledge: capturedKnowledge || [],
        processedContext
      },
      systemPrompt
    };

    // In a production system, you would save this agent to a database
    // For the demo, we'll store it in memory or return it directly

    return NextResponse.json({
      success: true,
      agent: {
        agentId: agent.agentId,
        employeeName: agent.employeeName,
        role: agent.role,
        department: agent.department,
        createdAt: agent.createdAt,
        knowledgeItems: capturedKnowledge?.length || 0,
        artifactsProcessed: artifacts.length
      },
      // Include full agent for demo purposes
      fullAgent: agent
    });
  } catch (error) {
    console.error('Agent generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate agent', details: String(error) },
      { status: 500 }
    );
  }
}
