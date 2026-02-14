import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage } from '@/types/api';
import { getAgent, getAllAgents } from '@/lib/agentStore';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, message, conversationHistory, systemPrompt: providedSystemPrompt } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Get the agent's system prompt
    let systemPrompt = providedSystemPrompt;

    if (!systemPrompt && agentId) {
      const agent = getAgent(agentId);
      if (agent) {
        systemPrompt = agent.systemPrompt;
      }
    }

    // If still no system prompt, use a default
    if (!systemPrompt) {
      systemPrompt = `You are a helpful assistant that has been trained on the knowledge and expertise of a departing employee. Answer questions based on the context provided, and be honest when you don't have specific information.`;
    }

    // Build messages array for Claude
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    // Add conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: ChatMessage) => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Add the new message
    messages.push({
      role: 'user',
      content: message
    });

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages
    });

    // Extract the response text
    const responseText = response.content[0].type === 'text'
      ? response.content[0].text
      : 'I apologize, but I was unable to generate a response.';

    return NextResponse.json({
      message: responseText,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve agent info
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  if (!agentId) {
    // Return list of all agents
    const agents = getAllAgents().map(agent => ({
      agentId: agent.agentId,
      employeeName: agent.employeeName,
      role: agent.role,
      department: agent.department,
      createdAt: agent.createdAt
    }));

    return NextResponse.json({ agents });
  }

  const agent = getAgent(agentId);
  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    agentId: agent.agentId,
    employeeName: agent.employeeName,
    role: agent.role,
    department: agent.department,
    createdAt: agent.createdAt,
    knowledgeItems: agent.knowledgeBase.capturedKnowledge.length,
    artifactsProcessed: agent.knowledgeBase.artifacts.length
  });
}
