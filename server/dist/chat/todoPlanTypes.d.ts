/**
 * Codex CLI 的 TODO/Checklist（由 `turn/plan/updated` 等事件驱动）。
 * 说明：状态统一收敛为 snake_case，便于前端样式与统计。
 */
export type TodoPlanStepStatus = "pending" | "in_progress" | "completed";
/**
 * TODO/Checklist 的单步条目。
 */
export type TodoPlanStep = {
    status: TodoPlanStepStatus;
    step: string;
};
/**
 * WS 事件解析后的 TODO 更新载荷（用于上报到 App 状态）。
 */
export type TodoPlanUpdate = {
    threadId: string;
    turnId: string | null;
    explanation: string | null;
    plan: TodoPlanStep[];
};
