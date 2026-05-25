import { WORKER_WALL_CLOCK_BUDGET_MS } from "./constants.ts";

export interface WorkerWallClockBudget {
  startedAt: number;
  budgetMs: number;
}

export function createWorkerWallClockBudget(
  budgetMs = WORKER_WALL_CLOCK_BUDGET_MS,
): WorkerWallClockBudget {
  return { startedAt: performance.now(), budgetMs };
}

export function workerWallClockElapsedMs(budget: WorkerWallClockBudget): number {
  return performance.now() - budget.startedAt;
}

export function isWorkerWallClockExceeded(budget: WorkerWallClockBudget): boolean {
  return workerWallClockElapsedMs(budget) >= budget.budgetMs;
}
