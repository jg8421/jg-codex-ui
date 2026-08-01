import type { TodoPlanUpdate } from "./todoPlanTypes";
/**
 * 解析 Codex 通知 payload（{method, params}），提取 TODO/Checklist 更新。
 *
 * 支持来源：
 * - app-server v2：`turn/plan/updated`
 */
export declare function extractTodoPlanUpdateFromCodexPayload(payload: unknown): TodoPlanUpdate | null;
