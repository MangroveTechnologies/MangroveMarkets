interface TaskCompleteEvent {
  taskId: string;
  result: string;
  timestamp: number;
}

/**
 * Hook called when an OpenClaw task completes. Logs the completion for analytics.
 * Can be extended to auto-refresh dashboard data or send notifications.
 * @param event - The task complete event containing taskId, result, and timestamp
 */
export async function onTaskComplete(event: TaskCompleteEvent): Promise<void> {
  console.log(`[MangroveMarkets] Task ${event.taskId} completed: ${event.result}`);
}
