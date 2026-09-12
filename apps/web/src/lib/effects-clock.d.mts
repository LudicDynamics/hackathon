interface Clock { request(callback: (time: number) => void): number; cancel(id: number): void }
export function createFrameTask(draw: () => void, clock?: Clock): { schedule(): void; cancel(): void };
export function createFrameLoop(draw: (delta: number) => void, clock?: Clock, interval?: number): { start(): void; stop(): void };
