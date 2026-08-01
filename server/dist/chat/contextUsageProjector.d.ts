/**
 * 从 websocket 事件 payload 中提取上下文使用率（百分比）。
 *
 * 口径优先级：
 * 1) 非 token 相关 method 直接跳过（避免误判）；
 * 2) 直接百分比字段；
 * 3) app-server v2 tokenUsage/token_count：`last_input_tokens / model_context_window`（缺失时回退 total）；
 * 4) 非 websocket `event` 包装时，才启用 prompt/remaining/context 的启发式回退。
 */
export declare function extractContextUsagePercentFromPayload(payload: unknown): number | null;
