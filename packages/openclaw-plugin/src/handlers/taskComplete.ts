interface TaskCompleteEvent {
  taskId: string;
  result: string;
  timestamp: number;
}

export async function onTaskComplete(event: TaskCompleteEvent): Promise<void> {
  console.log(`[MangroveMarkets] Task ${event.taskId} completed: ${event.result}`);
}
