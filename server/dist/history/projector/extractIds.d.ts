/**
 * 从事件参数中提取 turnId，兼容 camelCase/snake_case 与嵌套结构。
 */
export declare function extractTurnId(params: unknown): string | null;
/**
 * 从事件参数中提取 itemId，兼容多种字段路径。
 */
export declare function extractItemId(params: unknown): string | null;
/**
 * 构造 assistant message 的稳定消息 id。
 */
export declare function buildAgentMessageId(turnId: string | null, itemId: string | null): string | null;
/**
 * 构造 commandExecution message 的稳定消息 id。
 */
export declare function buildCommandExecutionMessageId(turnId: string | null, itemId: string | null): string | null;
/**
 * 构造 fileChange message 的稳定消息 id。
 */
export declare function buildFileChangeMessageId(turnId: string | null, itemId: string | null): string | null;
/**
 * 构造 user message 的稳定消息 id。
 */
export declare function buildUserMessageId(turnId: string | null, itemId: string | null): string | null;
/**
 * 构造 plan message 的稳定消息 id。
 */
export declare function buildPlanMessageId(turnId: string | null, itemId: string | null): string | null;
/**
 * 构造 reasoning summary message 的稳定消息 id。
 */
export declare function buildReasoningSummaryMessageId(turnId: string | null, itemId: string | null, summaryIndex: number): string | null;
/**
 * 构造 user input 审核轨迹消息 id（required / resolved）。
 */
export declare function buildUserInputAuditMessageId(threadId: string, requestId: unknown, phase: "required" | "resolved"): string;
