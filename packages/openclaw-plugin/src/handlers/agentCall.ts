interface AgentCallEvent {
  agentId: string;
  toolName: string;
  timestamp: number;
}

/**
 * Hook called when an OpenClaw agent invokes a tool. Logs the invocation
 * for analytics and debugging. Can be extended to enrich agent context.
 * @param event - The agent call event containing agentId, toolName, and timestamp
 */
export async function onAgentCall(event: AgentCallEvent): Promise<void> {
  console.log(`[MangroveMarkets] Agent ${event.agentId} called ${event.toolName}`);
}
