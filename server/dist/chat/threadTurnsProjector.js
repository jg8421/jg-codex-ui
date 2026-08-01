"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectThreadToChatItems = projectThreadToChatItems;
exports.projectTurnsToChatItems = projectTurnsToChatItems;
const attachmentPathRedaction_1 = require("./attachmentPathRedaction");
const chatItemEnricher_1 = require("./chatItemEnricher");
const fileChangeExtractor_1 = require("./fileChangeExtractor");
const skillCallMarker_1 = require("./skillCallMarker");
const extractIds_1 = require("../history/projector/extractIds");
/**
 * 将历史 turn 里的完整 diff 收敛为摘要，避免在聊天记录中携带大 patch 内容。
 */
function toDiffSummaryChanges(changes) {
    return changes.map((change) => ({
        path: change.path,
        kind: change.kind,
        diff: "",
        addedLines: Number.isFinite(change.addedLines) ? Math.max(0, Math.floor(Number(change.addedLines))) : 0,
        deletedLines: Number.isFinite(change.deletedLines) ? Math.max(0, Math.floor(Number(change.deletedLines))) : 0,
    }));
}
/**
 * 把 turns/item 中的 id 归一化为稳定字符串：
 * - 支持 string/number；
 * - 其他类型视为缺失，回退到既有的 best-effort id 生成逻辑。
 */
function normalizeStableId(rawId) {
    if (typeof rawId === "string")
        return rawId.trim();
    if (typeof rawId === "number" && Number.isFinite(rawId))
        return String(rawId);
    return "";
}
/**
 * 生成 legacy `<turnId>:<itemId>` 消息 id。
 *
 * 说明：当某类 turns item 还没有稳定 v2 约定时，继续使用 legacy 形态兜底。
 */
function buildLegacyTurnItemMessageId(turnId, itemId) {
    return `${turnId}:${itemId}`;
}
/**
 * 为 turns 快照生成与实时 chat_ops / SQLite 历史一致的稳定消息 id。
 */
function buildProjectedTurnItemMessageId(input) {
    const normalizedItemType = String(input.itemType ?? "").trim().toLowerCase();
    const legacyMessageId = buildLegacyTurnItemMessageId(input.turnId, input.itemId);
    if (input.hasFileChanges) {
        return (0, extractIds_1.buildFileChangeMessageId)(input.turnId, input.itemId) ?? legacyMessageId;
    }
    if (normalizedItemType.includes("plan")) {
        return (0, extractIds_1.buildPlanMessageId)(input.turnId, input.itemId) ?? legacyMessageId;
    }
    if (input.render === "terminal" || normalizedItemType.includes("command")) {
        return (0, extractIds_1.buildCommandExecutionMessageId)(input.turnId, input.itemId) ?? legacyMessageId;
    }
    if (input.role === "user") {
        return (0, extractIds_1.buildUserMessageId)(input.turnId, input.itemId) ?? legacyMessageId;
    }
    if (input.role === "assistant") {
        return (0, extractIds_1.buildAgentMessageId)(input.turnId, input.itemId) ?? legacyMessageId;
    }
    return legacyMessageId;
}
/**
 * 将 thread payload 中的 turns 转换为 ChatItem[]（用于 thread_opened 快照）。
 */
function projectThreadToChatItems(thread) {
    const t = thread;
    const turns = Array.isArray(t?.turns) ? t.turns : [];
    const turnsStart = Number.isFinite(t?.turnsStart) ? Math.max(0, Math.floor(Number(t.turnsStart))) : 0;
    const createdAtMs = Number.isFinite(t?.createdAt) ? Number(t.createdAt) * 1000 : Date.now();
    return projectTurnsToChatItems(turns, { createdAtMs, turnsStart });
}
/**
 * 将 thread turns slice 转换为 ChatItem[]（用于翻页加载旧消息）。
 */
function projectTurnsToChatItems(turns, opts) {
    const out = [];
    const baseTs = Number.isFinite(opts.createdAtMs) ? opts.createdAtMs : Date.now();
    const start = Number.isFinite(opts.turnsStart) ? Math.max(0, Math.floor(opts.turnsStart)) : 0;
    for (let turnIdx = 0; turnIdx < turns.length; turnIdx += 1) {
        const turn = turns[turnIdx];
        const stableTurnId = normalizeStableId(turn?.id);
        const turnId = stableTurnId || `turn-${start + turnIdx}`;
        const items = Array.isArray(turn?.items) ? turn.items : [];
        const turnTsBase = baseTs + (start + turnIdx) * 1000;
        for (let itemIdx = 0; itemIdx < items.length; itemIdx += 1) {
            const item = items[itemIdx];
            const changes = (0, fileChangeExtractor_1.extractFileChangesFromAny)(item);
            const role = roleFromTurnItem(item);
            const effectiveRole = role ?? (changes.length ? "system" : null);
            if (!effectiveRole)
                continue;
            const stableItemId = normalizeStableId(item?.id);
            const itemId = stableItemId || `${role}-${out.length}`;
            const itemType = typeof item?.type === "string" ? String(item.type).toLowerCase() : "";
            if (changes.length) {
                const title = "文件变更";
                const summaryChanges = toDiffSummaryChanges(changes);
                const messageId = buildProjectedTurnItemMessageId({
                    turnId,
                    itemId,
                    role: effectiveRole,
                    itemType,
                    hasFileChanges: true,
                });
                out.push((0, chatItemEnricher_1.enrichChatItemForUi)({
                    id: messageId,
                    ts: turnTsBase + itemIdx,
                    role: effectiveRole === "assistant" ? "system" : effectiveRole,
                    text: title,
                    render: "diff",
                    diff: { title, changes: summaryChanges },
                }));
                continue;
            }
            // reasoning summary 在 SQLite 历史中会按 summaryIndex 拆分为多条记录；
            // turns 投影也需要使用相同 v2 id，否则前端合并历史时会产生重复卡片。
            if (effectiveRole === "reasoning") {
                const summaryItems = Array.isArray(item?.summary) ? item.summary : [];
                if (summaryItems.length && stableItemId) {
                    for (let summaryIndex = 0; summaryIndex < summaryItems.length; summaryIndex += 1) {
                        const summaryText = String(summaryItems[summaryIndex] ?? "").trim();
                        const messageId = (0, extractIds_1.buildReasoningSummaryMessageId)(turnId, stableItemId, summaryIndex);
                        if (!summaryText || !messageId)
                            continue;
                        out.push((0, chatItemEnricher_1.enrichChatItemForUi)({
                            id: messageId,
                            // turns 的 ts 仅用于排序；这里用极小增量确保每条 summary 在同一 item 内保持稳定顺序。
                            ts: turnTsBase + itemIdx + summaryIndex / 1000,
                            role: "reasoning",
                            text: summaryText,
                        }));
                    }
                    continue;
                }
            }
            const text = extractTurnItemText(item);
            if (!text)
                continue;
            const displayText = effectiveRole === "user" ? (0, attachmentPathRedaction_1.redactAttachmentPathsForDisplay)(text) : text;
            const render = typeof item?.command === "string" ? "terminal" : undefined;
            const skillCallMarker = (0, skillCallMarker_1.extractSkillCallMarkerFromCommandExecutionItem)(item);
            const messageId = buildProjectedTurnItemMessageId({
                turnId,
                itemId,
                role: effectiveRole,
                render,
                itemType,
                hasFileChanges: false,
            });
            out.push((0, chatItemEnricher_1.enrichChatItemForUi)({
                id: messageId,
                ts: turnTsBase + itemIdx,
                role: effectiveRole,
                text: displayText,
                render,
                skillCallMarker,
                deliveryStatus: effectiveRole === "user" ? "sent" : undefined,
            }));
        }
    }
    return out;
}
/**
 * 从 turn item 推导其角色（兼容 `role` 字段与 `type` 字段）。
 */
function roleFromTurnItem(item) {
    const it = item;
    const role = typeof it?.role === "string" ? it.role.toLowerCase() : "";
    if (role === "user" || role === "assistant" || role === "system" || role === "reasoning")
        return role;
    const t = it?.type;
    if (typeof t !== "string")
        return null;
    const normalized = t.toLowerCase();
    if (normalized.includes("user"))
        return "user";
    if (normalized.includes("system"))
        return "system";
    if (normalized.includes("command"))
        return "system";
    if (normalized.includes("reasoning"))
        return "reasoning";
    if (normalized.includes("assistant") || normalized.includes("agent"))
        return "assistant";
    if (normalized.includes("plan"))
        return "assistant";
    return null;
}
/**
 * 将历史 plan step 的状态值归一化为 Web 侧统一状态。
 */
function normalizeStructuredPlanStepStatus(rawStatus) {
    if (typeof rawStatus !== "string")
        return null;
    const normalized = rawStatus
        .trim()
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
    if (!normalized)
        return null;
    if (normalized === "pending")
        return "pending";
    if (normalized === "completed" || normalized === "done")
        return "completed";
    if (normalized === "in_progress" || normalized === "inprogress" || normalized === "doing")
        return "in_progress";
    return null;
}
/**
 * 从结构化 step 对象中抽取可展示的文本。
 */
function extractStructuredPlanStepText(rawStep) {
    if (typeof rawStep === "string")
        return rawStep.trim();
    if (!rawStep || typeof rawStep !== "object")
        return "";
    const step = rawStep;
    const candidates = [step.step, step.text, step.title, step.description, step.name, step.task, step.label];
    for (const candidate of candidates) {
        if (typeof candidate !== "string")
            continue;
        const normalizedText = candidate.trim();
        if (normalizedText)
            return normalizedText;
    }
    return "";
}
/**
 * 从结构化 plan item 中提取步骤数组（兼容 plan/steps/items 字段）。
 */
function extractStructuredPlanSteps(item) {
    const stepSources = [item.plan, item.steps, item.items];
    const parsedSteps = [];
    for (const rawSource of stepSources) {
        if (!Array.isArray(rawSource))
            continue;
        for (const rawStep of rawSource) {
            const stepText = extractStructuredPlanStepText(rawStep);
            if (!stepText)
                continue;
            const stepRecord = rawStep && typeof rawStep === "object" ? rawStep : {};
            const statusFromStatusField = normalizeStructuredPlanStepStatus(stepRecord.status);
            const statusFromStateField = normalizeStructuredPlanStepStatus(stepRecord.state);
            const completedFlag = typeof stepRecord.completed === "boolean" ? stepRecord.completed : null;
            const inProgressFlag = typeof stepRecord.inProgress === "boolean" ? stepRecord.inProgress : null;
            const inProgressSnakeFlag = typeof stepRecord.in_progress === "boolean" ? stepRecord.in_progress : null;
            const status = statusFromStatusField ??
                statusFromStateField ??
                (inProgressFlag || inProgressSnakeFlag ? "in_progress" : null) ??
                (completedFlag === null ? null : completedFlag ? "completed" : "pending") ??
                "pending";
            parsedSteps.push({ status, step: stepText });
        }
        if (parsedSteps.length)
            return parsedSteps;
    }
    return parsedSteps;
}
/**
 * 当历史 plan item 缺少 `text` 时，将结构化字段拼成可复用的文本计划。
 */
function extractStructuredPlanText(item) {
    const explanationFromField = typeof item.explanation === "string" ? item.explanation.trim() : "";
    const summaryFromArray = Array.isArray(item.summary)
        ? item.summary.map((value) => String(value ?? "").trim()).filter(Boolean).join("\n")
        : "";
    const explanation = explanationFromField || summaryFromArray;
    const steps = extractStructuredPlanSteps(item);
    if (!steps.length)
        return explanation;
    const stepLines = steps.map((step) => `- (${step.status}) ${step.step}`);
    if (!explanation)
        return stepLines.join("\n");
    return `${explanation}\n${stepLines.join("\n")}`.trim();
}
/**
 * 从 turn item 中抽取可展示的 text（兼容多种字段与结构化 plan）。
 */
function extractTurnItemText(item) {
    const it = item;
    const itemType = typeof it?.type === "string" ? String(it.type).toLowerCase() : "";
    if (typeof it?.text === "string")
        return it.text;
    if (typeof it?.message === "string")
        return it.message;
    if (itemType.includes("plan")) {
        const structuredPlanText = extractStructuredPlanText(it);
        if (structuredPlanText)
            return structuredPlanText;
    }
    if (Array.isArray(it?.summary) && it.summary.length) {
        return it.summary.map(String).filter(Boolean).join("\n").trim();
    }
    if (typeof it?.command === "string") {
        const aggregated = typeof it?.aggregatedOutput === "string" ? it.aggregatedOutput : "";
        const exit = typeof it?.exitCode === "number" ? `exitCode=${it.exitCode}` : "";
        const header = `command: ${it.command}${exit ? ` (${exit})` : ""}`;
        if (aggregated && aggregated.trim())
            return `${header}\n\n${aggregated}`.trim();
        return header;
    }
    const content = Array.isArray(it?.content)
        ? it.content
        : Array.isArray(it?.contentItems)
            ? it.contentItems
            : null;
    if (content) {
        const parts = content
            .map((p) => extractTextPart(p))
            .filter((s) => Boolean(s && s.trim()));
        return parts.join("\n").trim();
    }
    return "";
}
/**
 * 从 content item 中提取文本字段。
 */
function extractTextPart(part) {
    const p = part;
    if (!p)
        return null;
    if (typeof p === "string")
        return p;
    if (typeof p?.text === "string")
        return p.text;
    if (typeof p?.value === "string")
        return p.value;
    return null;
}
//# sourceMappingURL=threadTurnsProjector.js.map