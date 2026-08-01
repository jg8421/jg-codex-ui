"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHistoryQueryService = createHistoryQueryService;
const chatItemEnricher_1 = require("../../chat/chatItemEnricher");
const fileChangeExtractor_1 = require("../../chat/fileChangeExtractor");
/**
 * 选择消息的展示时间戳，优先 finished -> started -> created -> updated。
 */
function resolveMessageTimestamp(message) {
    const candidates = [message.finishedAtMs, message.startedAtMs, message.createdAtMs, message.updatedAtMs];
    for (const candidate of candidates) {
        const parsedTs = Number(candidate);
        if (!Number.isFinite(parsedTs))
            continue;
        const normalizedTs = Math.max(0, Math.floor(parsedTs));
        if (normalizedTs > 0)
            return normalizedTs;
    }
    return 0;
}
/**
 * 将 DB role 值收敛到 UI 允许的联合类型。
 */
function normalizeChatRole(rawRole) {
    const role = String(rawRole ?? "").trim();
    if (role === "user" || role === "assistant" || role === "system" || role === "reasoning")
        return role;
    return "assistant";
}
/**
 * 判断角色是否属于分页“边界”（仅 user/assistant）。
 */
function isUaBoundaryRole(role) {
    return role === "user" || role === "assistant";
}
/**
 * 按“user/assistant 边界数量”截取窗口（升序数组）。
 *
 * 规则：
 * - limit 只统计 user/assistant；
 * - 夹在边界之间的 system/reasoning 等会跟随窗口一起返回；
 * - 若窗口落在“第一条边界”，则需要把其之前的前导非边界一并返回（方案 A）。
 */
function sliceByUaBoundaryLimit(itemsAsc, limit) {
    // normalizedLimit：收敛为非负整数，避免出现 NaN/小数导致的意外行为。
    const normalizedLimit = Math.max(0, Math.floor(Number(limit)));
    if (normalizedLimit <= 0)
        return [];
    // firstBoundaryIndex：第一条 user/assistant 边界的下标（用于判断是否需要并入前导非边界）。
    const firstBoundaryIndex = itemsAsc.findIndex((item) => isUaBoundaryRole(item.role));
    if (firstBoundaryIndex === -1)
        return itemsAsc;
    // boundaryCount：已累计的 user/assistant 边界数量（从尾部向前扫描）。
    let boundaryCount = 0;
    // startBoundaryIndex：命中的窗口起点边界下标（包含该条消息）。
    let startBoundaryIndex = null;
    for (let i = itemsAsc.length - 1; i >= 0; i -= 1) {
        const item = itemsAsc[i];
        if (!isUaBoundaryRole(item.role))
            continue;
        boundaryCount += 1;
        if (boundaryCount === normalizedLimit) {
            startBoundaryIndex = i;
            break;
        }
    }
    // 边界不足 limit：直接返回全部（自然包含第一条边界之前的前导非边界）。
    if (startBoundaryIndex === null)
        return itemsAsc;
    // 若窗口起点落在第一条边界，则需要并入其之前的前导非边界（方案 A）。
    if (startBoundaryIndex === firstBoundaryIndex)
        return itemsAsc;
    return startBoundaryIndex >= itemsAsc.length ? [] : itemsAsc.slice(startBoundaryIndex);
}
/**
 * 安全解析 file_change 的 changes JSON；解析失败时返回空数组。
 */
function parseFileChangeJson(rawJson) {
    const normalizedJson = String(rawJson ?? "").trim();
    if (!normalizedJson)
        return [];
    try {
        const parsed = JSON.parse(normalizedJson);
        if (!Array.isArray(parsed))
            return [];
        const out = [];
        for (const rawChange of parsed) {
            const change = (rawChange ?? {});
            const path = String(change.path ?? "").trim();
            if (!path)
                continue;
            const kind = String(change.kind ?? "change").trim() || "change";
            const diff = typeof change.diff === "string"
                ? change.diff
                : typeof change.patch === "string"
                    ? change.patch
                    : typeof change.unifiedDiff === "string"
                        ? change.unifiedDiff
                        : "";
            // addedLines/deletedLines：优先读取结构化字段，缺失时从 diff 文本计算。
            const addedLinesFromField = Number(change.addedLines ?? change.added_lines);
            const deletedLinesFromField = Number(change.deletedLines ?? change.deleted_lines);
            const countedLineStats = (0, fileChangeExtractor_1.countUnifiedDiffLineStats)(diff);
            const addedLines = Number.isFinite(addedLinesFromField)
                ? Math.max(0, Math.floor(addedLinesFromField))
                : countedLineStats.addedLines;
            const deletedLines = Number.isFinite(deletedLinesFromField)
                ? Math.max(0, Math.floor(deletedLinesFromField))
                : countedLineStats.deletedLines;
            out.push({ path, kind, diff, addedLines, deletedLines });
        }
        return out;
    }
    catch {
        return [];
    }
}
/**
 * 生成 file_change 的展示标题：优先 diffTitle，其次 finalText，最后兜底“文件变更”。
 */
function resolveDiffTitle(message) {
    return String(message.diffTitle ?? "").trim() || String(message.finalText ?? "").trim() || "文件变更";
}
/**
 * 从 messageType 中提取 skill 调用标记。
 *
 * 协议约定：
 * - `command_execution_skill:<skillName>` 表示命中 skill 调用；
 * - 其他值返回 null。
 */
function extractSkillCallMarkerFromMessageType(messageType) {
    const normalizedMessageType = String(messageType ?? "").trim();
    const prefix = "command_execution_skill:";
    if (!normalizedMessageType.startsWith(prefix))
        return null;
    const skillName = normalizedMessageType.slice(prefix.length).trim();
    if (!skillName)
        return null;
    return { name: skillName };
}
/**
 * 将完整 changes 列表转为摘要版本（仅保留 path/kind）。
 */
function toSummaryChanges(changes) {
    return changes.map((change) => ({
        path: change.path,
        kind: change.kind,
        diff: "",
        addedLines: Number.isFinite(change.addedLines) ? Math.max(0, Math.floor(Number(change.addedLines))) : 0,
        deletedLines: Number.isFinite(change.deletedLines) ? Math.max(0, Math.floor(Number(change.deletedLines))) : 0,
    }));
}
/**
 * 将 file_change_entries 的索引行按 messageId 聚合为摘要 diff 数据。
 */
function groupFileChangeEntriesByMessageId(entries) {
    // groupByMessageId：按 messageId 聚合，同一消息下可能有多条 path。
    const groupByMessageId = new Map();
    for (const entry of entries) {
        const messageId = String(entry.messageId ?? "").trim();
        if (!messageId)
            continue;
        const existing = groupByMessageId.get(messageId);
        const tsMs = Math.max(0, Math.floor(Number(entry.tsMs)));
        const changePath = String(entry.path ?? "").trim();
        if (!changePath)
            continue;
        // changeKind：兜底为 change，避免空值导致 UI 断言失败。
        const changeKind = String(entry.kind ?? "change").trim() || "change";
        // addedLines/deletedLines：索引表内已持久化；缺失时兜底为 0。
        const addedLines = Number.isFinite(entry.addedLines) ? Math.max(0, Math.floor(Number(entry.addedLines))) : 0;
        const deletedLines = Number.isFinite(entry.deletedLines) ? Math.max(0, Math.floor(Number(entry.deletedLines))) : 0;
        const change = { path: changePath, kind: changeKind, diff: "", addedLines, deletedLines };
        if (!existing) {
            groupByMessageId.set(messageId, { messageId, tsMs, changes: [change] });
            continue;
        }
        existing.tsMs = Math.max(existing.tsMs, tsMs);
        existing.changes.push(change);
    }
    const groups = Array.from(groupByMessageId.values());
    groups.sort((a, b) => b.tsMs - a.tsMs || b.messageId.localeCompare(a.messageId));
    return groups;
}
/**
 * 将索引聚合结果转为可渲染的 diff ChatItem（摘要模式）。
 */
function toDiffChatItemFromEntryGroup(group) {
    // title：索引表不存 diffTitle，统一兜底为“文件变更”（展开详情时再按 messageId 拉取完整 title）。
    const title = "文件变更";
    const baseItem = {
        id: group.messageId,
        ts: group.tsMs,
        role: "system",
        text: title,
        streaming: false,
        render: "diff",
        diff: {
            title,
            changes: group.changes,
        },
    };
    return (0, chatItemEnricher_1.enrichChatItemForUi)(baseItem);
}
/**
 * 从消息记录构建 diff 渲染数据。
 * - summary：用于聊天列表，隐藏 patch/output 正文；
 * - full：用于按需详情接口，返回完整 diff/output。
 */
function buildMessageDiffData(message, mode) {
    if (message.messageType !== "file_change")
        return null;
    const title = resolveDiffTitle(message);
    const parsedChanges = parseFileChangeJson(message.diffChangesJson);
    const parsedOutput = String(message.diffOutput ?? "");
    const hasOutput = Boolean(parsedOutput.trim());
    const hasChanges = parsedChanges.length > 0;
    if (!hasChanges && !hasOutput)
        return null;
    if (mode === "summary") {
        return {
            title,
            changes: toSummaryChanges(parsedChanges),
        };
    }
    return {
        title,
        changes: parsedChanges,
        output: hasOutput ? parsedOutput : undefined,
    };
}
/**
 * 将 DB MessageRecord 转为可渲染 ChatItem。
 */
function toChatItem(message) {
    const id = message.messageId;
    const role = normalizeChatRole(message.role);
    const streaming = message.status !== "done";
    const ts = resolveMessageTimestamp(message);
    const baseItem = {
        id,
        role,
        text: message.finalText,
        ts,
        streaming,
    };
    // UIA 审核/选择题记录统一走 approval 卡片。
    if (id.startsWith("v2:uia-")) {
        baseItem.render = "approval";
        return (0, chatItemEnricher_1.enrichChatItemForUi)(baseItem);
    }
    const isCommandExecution = message.messageType === "command_execution" || message.messageType.startsWith("command_execution_skill:");
    if (isCommandExecution) {
        baseItem.render = "terminal";
        baseItem.skillCallMarker = extractSkillCallMarkerFromMessageType(message.messageType);
        return (0, chatItemEnricher_1.enrichChatItemForUi)(baseItem);
    }
    if (message.messageType !== "file_change") {
        return (0, chatItemEnricher_1.enrichChatItemForUi)(baseItem);
    }
    const diff = buildMessageDiffData(message, "summary");
    if (!diff)
        return (0, chatItemEnricher_1.enrichChatItemForUi)(baseItem);
    return (0, chatItemEnricher_1.enrichChatItemForUi)({
        ...baseItem,
        text: diff.title,
        render: "diff",
        diff,
    });
}
/**
 * 创建历史查询服务。
 */
function createHistoryQueryService(options) {
    return {
        /**
         * 列出线程内 file_change 列表（摘要），用于“文件变更”弹窗首屏。
         */
        listThreadFileChanges(threadId) {
            const normalizedThreadId = String(threadId ?? "").trim();
            if (!normalizedThreadId)
                return [];
            const listEntries = options.store.listFileChangeEntriesByThread;
            if (typeof listEntries === "function") {
                const entries = listEntries(normalizedThreadId);
                const groups = groupFileChangeEntriesByMessageId(entries);
                return groups.map(toDiffChatItemFromEntryGroup);
            }
            // 回退：旧 store 不支持索引表时，扫描 messages 并筛选 diff（性能较差，但保持功能可用）。
            const records = options.store.listMessagesByThread(normalizedThreadId);
            const items = records.map((record) => toChatItem(record));
            const diffItems = items.filter((item) => item.render === "diff" && Boolean(item.diff));
            diffItems.sort((a, b) => b.ts - a.ts || b.id.localeCompare(a.id));
            return diffItems;
        },
        /**
         * 按线程查询历史消息：
         * - 查询窗口按 UA 边界计数；
         * - 返回结果按时间降序（最新在前），便于“先看最新，再向上翻更早”。
         */
        listMessages(input) {
            const listByUaBoundaryPage = options.store.listMessagesByThreadUaBoundaryPage;
            if (typeof listByUaBoundaryPage === "function") {
                const records = listByUaBoundaryPage({
                    threadId: input.threadId,
                    limit: input.limit,
                    beforeTs: input.beforeTs,
                });
                // itemsAsc：store 下推返回的是时间升序窗口，这里统一转为“最新在前”。
                const itemsAsc = records.map((record) => toChatItem(record));
                return itemsAsc.reverse();
            }
            const records = options.store.listMessagesByThread(input.threadId);
            const items = records.map((record) => toChatItem(record));
            // 显式收敛 beforeTs 类型，避免闭包里出现 `number | null` 推断。
            const beforeTs = input.beforeTs;
            const filteredItems = beforeTs === null ? items : items.filter((item) => item.ts < beforeTs);
            // pageItemsAsc：内存算法返回时间升序窗口，这里统一转为“最新在前”。
            const pageItemsAsc = sliceByUaBoundaryLimit(filteredItems, input.limit);
            return pageItemsAsc.reverse();
        },
        /**
         * 查询单条 file_change 的完整 diff 详情（按需加载专用）。
         */
        getMessageDiff(input) {
            const normalizedThreadId = String(input.threadId ?? "").trim();
            const normalizedMessageId = String(input.messageId ?? "").trim();
            if (!normalizedThreadId || !normalizedMessageId)
                return null;
            // getMessageByThreadAndMessageId：若 store 支持主键直查，优先使用以避免长线程全量扫描。
            const getById = options.store.getMessageByThreadAndMessageId;
            if (typeof getById === "function") {
                const record = getById(normalizedThreadId, normalizedMessageId);
                if (!record)
                    return null;
                return buildMessageDiffData(record, "full");
            }
            // 回退：旧 store 仅支持按线程全量列出，再在内存里定位目标消息。
            const records = options.store.listMessagesByThread(normalizedThreadId);
            const targetRecord = records.find((record) => record.messageId === normalizedMessageId);
            if (!targetRecord)
                return null;
            return buildMessageDiffData(targetRecord, "full");
        },
    };
}
//# sourceMappingURL=historyQueryService.js.map