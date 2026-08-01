"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTurnId = extractTurnId;
exports.extractItemId = extractItemId;
exports.buildAgentMessageId = buildAgentMessageId;
exports.buildCommandExecutionMessageId = buildCommandExecutionMessageId;
exports.buildFileChangeMessageId = buildFileChangeMessageId;
exports.buildUserMessageId = buildUserMessageId;
exports.buildPlanMessageId = buildPlanMessageId;
exports.buildReasoningSummaryMessageId = buildReasoningSummaryMessageId;
exports.buildUserInputAuditMessageId = buildUserInputAuditMessageId;
/**
 * 从候选字段中选择第一个非空 id 字符串。
 */
function pickFirstNonEmptyId(candidates) {
    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined)
            continue;
        const normalizedId = String(candidate).trim();
        if (normalizedId)
            return normalizedId;
    }
    return null;
}
/**
 * 从事件参数中提取 turnId，兼容 camelCase/snake_case 与嵌套结构。
 */
function extractTurnId(params) {
    const payload = params;
    return pickFirstNonEmptyId([
        payload?.turnId,
        payload?.turn_id,
        payload?.turn?.id,
        payload?.item?.turnId,
        payload?.item?.turn_id,
        payload?.item?.turn?.id,
    ]);
}
/**
 * 从事件参数中提取 itemId，兼容多种字段路径。
 */
function extractItemId(params) {
    const payload = params;
    return pickFirstNonEmptyId([
        payload?.itemId,
        payload?.item_id,
        payload?.item?.id,
        payload?.id,
    ]);
}
/**
 * 构造 assistant message 的稳定消息 id。
 */
function buildAgentMessageId(turnId, itemId) {
    if (!turnId || !itemId)
        return null;
    return `v2:am-${turnId}:${itemId}`;
}
/**
 * 构造 commandExecution message 的稳定消息 id。
 */
function buildCommandExecutionMessageId(turnId, itemId) {
    if (!turnId || !itemId)
        return null;
    return `v2:cmd-${turnId}:${itemId}`;
}
/**
 * 构造 fileChange message 的稳定消息 id。
 */
function buildFileChangeMessageId(turnId, itemId) {
    if (!turnId || !itemId)
        return null;
    return `v2:fc-${turnId}:${itemId}`;
}
/**
 * 构造 user message 的稳定消息 id。
 */
function buildUserMessageId(turnId, itemId) {
    if (!turnId || !itemId)
        return null;
    return `v2:um-${turnId}:${itemId}`;
}
/**
 * 构造 plan message 的稳定消息 id。
 */
function buildPlanMessageId(turnId, itemId) {
    if (!turnId || !itemId)
        return null;
    return `v2:plan-${turnId}:${itemId}`;
}
/**
 * 构造 reasoning summary message 的稳定消息 id。
 */
function buildReasoningSummaryMessageId(turnId, itemId, summaryIndex) {
    if (!turnId || !itemId)
        return null;
    const normalizedSummaryIndex = Number.isFinite(summaryIndex)
        ? Math.max(0, Math.floor(summaryIndex))
        : 0;
    return `v2:rs-${turnId}:${itemId}:${normalizedSummaryIndex}`;
}
/**
 * 构造 user input 审核轨迹消息 id（required / resolved）。
 */
function buildUserInputAuditMessageId(threadId, requestId, phase) {
    const normalizedThreadId = String(threadId ?? "").trim() || "unknown-thread";
    const normalizedRequestId = String(requestId ?? "").trim() || "unknown-request";
    const safeRequestId = normalizedRequestId.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `v2:uia-${phase}-${normalizedThreadId}:${safeRequestId}`;
}
//# sourceMappingURL=extractIds.js.map