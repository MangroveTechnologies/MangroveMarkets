import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import type { ToolCallResult, ToolResponse } from '../types/transport';

export const RESULT_FORMAT_HEADER = 'X-Mangrove-Result-Format';
export const RESULT_FORMAT = 'mcp-v1';

/** A call failed. Full response details remain available without logging them. */
export class ToolCallError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly response?: ToolResponse,
    public readonly suggestion?: string,
    /** Unvalidated response data for explicit inspection; never include in messages. */
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'ToolCallError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseResult(value: unknown): ToolResponse['result'] {
  const parsed = CallToolResultSchema.safeParse(value);
  if (!parsed.success) {
    // Validation diagnostics can echo response payloads. Do not attach them.
    throw new ToolCallError('Malformed MCP tool response', 'MALFORMED_RESPONSE');
  }
  const result = parsed.data;
  if ([result.structuredContent, textData(result)].some(data => isRecord(data) && data.error === true)) {
    result.isError = true;
  }
  return result;
}

function textData(result: ToolResponse['result']): unknown {
  const block = result.content.find(item => item.type === 'text');
  if (!block || block.type !== 'text') return undefined;
  try { return JSON.parse(block.text); } catch { return undefined; }
}

export function dataFromResponse(response: ToolResponse): ToolCallResult {
  const text = textData(response.result);
  const structured = response.result.structuredContent;
  const data = isRecord(structured) && structured.error === true ? structured : (text ?? structured);
  if (response.result.isError || (isRecord(data) && data.error === true)) {
    throw new ToolCallError(
      isRecord(data) && typeof data.message === 'string' ? data.message : 'Tool execution failed',
      isRecord(data) && typeof data.code === 'string' ? data.code : 'TOOL_ERROR',
      response,
      isRecord(data) && typeof data.suggestion === 'string' ? data.suggestion : undefined,
    );
  }
  if (!isRecord(data)) {
    throw new ToolCallError('Expected JSON object tool data; use callToolResult for other content',
      'MALFORMED_RESPONSE', response);
  }
  return data;
}

export function legacyResponse(data: unknown, status?: number, headers?: Record<string, string>): ToolResponse {
  return {
    result: {
      content: [{ type: 'text', text: JSON.stringify(data) ?? 'null' }],
      ...(isRecord(data) ? { structuredContent: data } : {}),
      isError: isRecord(data) && data.error === true,
    },
    status,
    headers,
  };
}
