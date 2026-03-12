import { describe, it, expect, vi } from 'vitest';
import { onAgentCall } from '../handlers/agentCall';
import { onTaskComplete } from '../handlers/taskComplete';

describe('onAgentCall', () => {
  it('logs the agent call event', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await onAgentCall({ agentId: 'agent-1', toolName: 'mangrove_dex_quote', timestamp: Date.now() });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('agent-1'));
    spy.mockRestore();
  });
});

describe('onTaskComplete', () => {
  it('logs the task completion event', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await onTaskComplete({ taskId: 'task-1', result: 'success', timestamp: Date.now() });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('task-1'));
    spy.mockRestore();
  });
});
