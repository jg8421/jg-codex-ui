"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFileChangeDetailByMessageId = buildFileChangeDetailByMessageId;
const extractIds_1 = require("../projector/extractIds");
/**
 * 安全解析 raw_event 的 payload_json。
 */
function parseRawEventPayload(rawEvent) {
    const rawPayloadJson = String(rawEvent.payloadJson ?? "").trim();
    if (!rawPayloadJson)
        return null;
    try {
        const parsedPayload = JSON.parse(rawPayloadJson);
        const method = typeof parsedPayload.method === "string" ? parsedPayload.method.trim() : "";
        if (!method)
            return null;
        return { method, params: parsedPayload.params };
    }
    catch {
        return null;
    }
}
/**
 * 归一化候选字符串；空值返回空串。
 */
function normalizeStringCandidate(rawCandidate) {
    if (typeof rawCandidate !== "string")
        return "";
    return rawCandidate.trim();
}
/**
 * 归一化 file change path，兼容常见字段变体与嵌套对象。
 */
function normalizeFileChangePath(change) {
    const rawPath = change.path ??
        change.file ??
        change.filename ??
        change.target?.path ??
        change.target?.file ??
        change.source?.path ??
        change.source?.file;
    const directPath = normalizeStringCandidate(rawPath);
    if (directPath)
        return directPath;
    if (rawPath && typeof rawPath === "object") {
        const nestedPathObject = rawPath;
        const nestedPath = normalizeStringCandidate(nestedPathObject.path) ||
            normalizeStringCandidate(nestedPathObject.file) ||
            normalizeStringCandidate(nestedPathObject.filename) ||
            normalizeStringCandidate(nestedPathObject.value) ||
            normalizeStringCandidate(nestedPathObject.text);
        if (nestedPath)
            return nestedPath;
    }
    return "";
}
/**
 * 归一化 file change kind，避免对象值直接转成 `[object Object]`。
 */
function normalizeFileChangeKind(change) {
    const rawKind = change.kind ?? change.type ?? change.action ?? change.operation ?? change.op ?? change.status;
    const directKind = normalizeStringCandidate(rawKind);
    if (directKind)
        return directKind;
    if (rawKind && typeof rawKind === "object") {
        const nestedKindObject = rawKind;
        const nestedKind = normalizeStringCandidate(nestedKindObject.kind) ||
            normalizeStringCandidate(nestedKindObject.type) ||
            normalizeStringCandidate(nestedKindObject.action) ||
            normalizeStringCandidate(nestedKindObject.operation) ||
            normalizeStringCandidate(nestedKindObject.op) ||
            normalizeStringCandidate(nestedKindObject.status) ||
            normalizeStringCandidate(nestedKindObject.value) ||
            normalizeStringCandidate(nestedKindObject.name) ||
            normalizeStringCandidate(nestedKindObject.label) ||
            normalizeStringCandidate(nestedKindObject.text);
        if (nestedKind)
            return nestedKind;
        const truthyKey = Object.entries(nestedKindObject).find((entry) => entry[1] === true)?.[0];
        const normalizedTruthyKey = normalizeStringCandidate(truthyKey);
        if (normalizedTruthyKey)
            return normalizedTruthyKey;
    }
    return "change";
}
/**
 * 把未知 changes 数组归一化为稳定结构。
 */
function normalizeFileChanges(rawChanges) {
    const rawArray = Array.isArray(rawChanges) ? rawChanges : [];
    const normalizedChanges = [];
    for (const rawChange of rawArray) {
        const changeRecord = rawChange ?? {};
        const path = normalizeFileChangePath(changeRecord);
        if (!path)
            continue;
        const kind = normalizeFileChangeKind(changeRecord);
        const diff = typeof rawChange?.diff === "string"
            ? String(rawChange.diff)
            : typeof rawChange?.patch === "string"
                ? String(rawChange.patch)
                : typeof rawChange?.unifiedDiff === "string"
                    ? String(rawChange.unifiedDiff)
                    : "";
        normalizedChanges.push({ path, kind, diff });
    }
    return normalizedChanges;
}
/**
 * 从未知对象中抽取文件变更列表。
 */
function extractFileChangesFromAny(raw) {
    const payload = raw;
    if (!payload)
        return [];
    return normalizeFileChanges(payload?.changes ??
        payload?.diff?.changes ??
        payload?.patch?.changes ??
        payload?.fileChanges ??
        payload?.file_changes ??
        payload?.files ??
        payload?.edits ??
        []);
}
/**
 * 判断 item.type 是否可视为 file change 类型。
 */
function isFileChangeItemType(rawItemType) {
    const normalizedItemType = String(rawItemType ?? "").trim().toLowerCase();
    if (!normalizedItemType)
        return false;
    if (normalizedItemType === "filechange" || normalizedItemType === "file_change")
        return true;
    return normalizedItemType.includes("file") || normalizedItemType.includes("patch");
}
/**
 * 判断 method 是否为 file change 增量输出事件。
 */
function isFileChangeDeltaMethod(method) {
    const normalizedMethod = method.trim().toLowerCase();
    if (!normalizedMethod)
        return false;
    if (normalizedMethod === "item/filechange/outputdelta")
        return true;
    return normalizedMethod.startsWith("item/") && normalizedMethod.includes("filechange") && normalizedMethod.endsWith("delta");
}
/**
 * 解析 file change 展示标题，优先 title，再退回 text，最后使用稳定默认值。
 */
function resolveFileChangeTitle(rawItem) {
    const item = (rawItem ?? {});
    const title = normalizeStringCandidate(item.title);
    if (title)
        return title;
    const text = normalizeStringCandidate(item.text);
    if (text)
        return text;
    return "文件变更";
}
/**
 * 获取或初始化 messageId 对应的 file change 详情。
 */
function getOrCreateDetail(detailByMessageId, messageId) {
    const existingDetail = detailByMessageId.get(messageId);
    if (existingDetail)
        return existingDetail;
    const nextDetail = { title: "文件变更", changes: [] };
    detailByMessageId.set(messageId, nextDetail);
    return nextDetail;
}
/**
 * 从 raw_events 重建 file_change 详情映射（messageId -> detail）。
 */
function buildFileChangeDetailByMessageId(rawEvents) {
    const detailByMessageId = new Map();
    for (const rawEvent of rawEvents) {
        const parsedPayload = parseRawEventPayload(rawEvent);
        if (!parsedPayload)
            continue;
        const method = parsedPayload.method;
        const params = parsedPayload.params;
        if (method === "item/started" || method === "item/completed") {
            const item = params?.item;
            const rawItemType = item?.type ?? params?.itemType ?? params?.item_type;
            if (!isFileChangeItemType(rawItemType))
                continue;
            const turnId = (0, extractIds_1.extractTurnId)(params);
            const itemId = (0, extractIds_1.extractItemId)(params);
            const messageId = (0, extractIds_1.buildFileChangeMessageId)(turnId, itemId);
            if (!messageId)
                continue;
            const detail = getOrCreateDetail(detailByMessageId, messageId);
            detail.title = resolveFileChangeTitle(item);
            const extractedChanges = extractFileChangesFromAny(item ?? params);
            if (extractedChanges.length)
                detail.changes = extractedChanges;
            continue;
        }
        if (!isFileChangeDeltaMethod(method))
            continue;
        const turnId = (0, extractIds_1.extractTurnId)(params);
        const itemId = (0, extractIds_1.extractItemId)(params);
        const messageId = (0, extractIds_1.buildFileChangeMessageId)(turnId, itemId);
        const deltaText = String(params?.delta ?? "");
        if (!messageId || !deltaText)
            continue;
        const detail = getOrCreateDetail(detailByMessageId, messageId);
        detail.output = `${detail.output ?? ""}${deltaText}`;
    }
    return detailByMessageId;
}
//# sourceMappingURL=fileChangeDetails.js.map