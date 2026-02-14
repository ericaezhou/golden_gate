import { GeneratedAgent } from '@/types/api';

// In-memory store for agents (in production, use a database)
const agentStore: Map<string, GeneratedAgent> = new Map();

// Function to set an agent (called from generate-agent or for testing)
export function setAgent(agent: GeneratedAgent) {
  agentStore.set(agent.agentId, agent);
}

// Function to get an agent
export function getAgent(agentId: string): GeneratedAgent | undefined {
  return agentStore.get(agentId);
}

// Function to get all agents
export function getAllAgents(): GeneratedAgent[] {
  return Array.from(agentStore.values());
}
