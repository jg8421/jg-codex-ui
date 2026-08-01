import type { ChatOp } from "./types";
import type { TodoPlanUpdate } from "./todoPlanTypes";
/**
 * 后端“聊天投影器”：
 * - 接收 Codex notification（method/params）；
 * - 产出 UI 可直接消费的 ChatOp（前端只需合并与渲染）；
 * - 并可选解析 TODO/上下文使用率等轻量附属状态。
 *
 * 说明：该投影器只支持 app-server v2 的 item/turn 生命周期事件；
 * 不再兼容 legacy `codex/event/*`（按你的要求移除旧版本兼容）。
 */
export declare class ChatProjector {
    /**
     * 递增计数器：用于生成 best-effort 的 fallback id。
     */
    private fallbackSeq;
    /**
     * 投影单条 Codex notification。
     */
    projectNotification(input: {
        threadId: string | null;
        payload: unknown;
        nowMs: number;
    }): {
        ops: ChatOp[];
        todoUpdate: TodoPlanUpdate | null;
        usagePercent: number | null;
    };
    /**
     * 生成 best-effort fallback id：用于 itemId 缺失等非理想输入。
     */
    private resolveFallbackId;
}
