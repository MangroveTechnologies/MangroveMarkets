import type { Transport, ToolCallResult } from '../../types/transport';

interface ToolCall {
  name: string;
  params: Record<string, unknown>;
}

export class MockTransport implements Transport {
  calls: ToolCall[] = [];
  private responses: Map<string, ToolCallResult[]> = new Map();

  addResponse(toolName: string, response: ToolCallResult): void {
    const existing = this.responses.get(toolName) || [];
    existing.push(response);
    this.responses.set(toolName, existing);
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    this.calls.push({ name, params });
    const queue = this.responses.get(name);
    if (!queue || queue.length === 0) {
      throw new Error(`No mock response for tool: ${name}`);
    }
    // If only one response, keep returning it; otherwise shift
    return queue.length === 1 ? queue[0] : queue.shift()!;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
