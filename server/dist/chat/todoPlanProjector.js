"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTodoPlanUpdateFromCodexPayload = extractTodoPlanUpdateFromCodexPayload;
/**
 * 判断值是否为普通对象，避免把 `null`/数组误判为可索引对象。
 */
function isPlainRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
/**
 * 归一化 threadId/turnId：空值返回 `null`。
 */
function normalizeId(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
/**
 * 归一化 explanation：空白字符串返回 `null`。
 */
function normalizeExplanation(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
/**
 * 将不同协议里的 step status 统一映射为 Web 内部的 snake_case。
 */
function normalizeTodoPlanStepStatus(value) {
    if (typeof value !== "string")
        return null;
    const raw = value.trim();
    if (!raw)
        return null;
    // app-server v2 使用 `inProgress`；v1/工具参数使用 `in_progress`。
    if (raw === "inProgress")
        return "in_progress";
    const lower = raw.toLowerCase();
    if (lower === "pending")
        return "pending";
    if (lower === "completed")
        return "completed";
    if (lower === "in_progress" || lower === "inprogress")
        return "in_progress";
    return null;
}
/**
 * 将未知结构的 plan 数组解析为 `TodoPlanStep[]`，并过滤非法条目。
 */
function normalizeTodoPlanSteps(value) {
    const steps = Array.isArray(value) ? value : [];
    const out = [];
    for (const stepItem of steps) {
        if (!isPlainRecord(stepItem))
            continue;
        const stepText = typeof stepItem.step === "string" ? stepItem.step.trim() : "";
        if (!stepText)
            continue;
        const status = normalizeTodoPlanStepStatus(stepItem.status);
        if (!status)
            continue;
        out.push({ status, step: stepText });
    }
    return out;
}
/**
 * 解析 Codex 通知 payload（{method, params}），提取 TODO/Checklist 更新。
 *
 * 支持来源：
 * - app-server v2：`turn/plan/updated`
 */
function extractTodoPlanUpdateFromCodexPayload(payload) {
    if (!isPlainRecord(payload))
        return null;
    const method = typeof payload.method === "string" ? payload.method : "";
    const params = payload.params;
    if (method === "turn/plan/updated") {
        if (!isPlainRecord(params))
            return null;
        const threadId = normalizeId(params.threadId ?? params.thread_id);
        if (!threadId)
            return null;
        const turnId = normalizeId(params.turnId ?? params.turn_id);
        const explanation = normalizeExplanation(params.explanation);
        const plan = normalizeTodoPlanSteps(params.plan);
        return { threadId, turnId, explanation, plan };
    }
    return null;
}
//# sourceMappingURL=todoPlanProjector.js.map