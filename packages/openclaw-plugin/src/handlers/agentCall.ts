interface AgentCallEvent {
  agentId: string;
  toolName: string;
  timestamp: number;
}

export async function onAgentCall(event: AgentCallEvent): Promise<void> {
  console.log(`[MangroveMarkets] Agent ${event.agentId} called ${event.toolName}`);
}
