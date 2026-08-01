"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlaceholderThreadPreview = isPlaceholderThreadPreview;
exports.deriveThreadPreviewFromUserMessageText = deriveThreadPreviewFromUserMessageText;
exports.pickPreferredThreadPreview = pickPreferredThreadPreview;
const DEFAULT_THREAD_TITLE_MAX_CHARS = 120;
const ATTACHMENT_LINE_REGEX = /^\s*\[attachment\]\s+/i;
/**
 * 规范化线程标题候选值：统一 trim，空字符串按无效处理。
 */
function normalizeThreadPreviewCandidate(value) {
    return String(value ?? "").trim();
}
/**
 * 判断给定 preview 是否仍是占位标题。
 *
 * 说明：
 * - 空字符串视为占位值；
 * - 与 threadId 完全相同的 preview 视为占位值；
 * - 其余 preview 认为是可展示标题。
 */
function isPlaceholderThreadPreview(input) {
    const normalizedThreadId = normalizeThreadPreviewCandidate(input.threadId);
    const normalizedPreview = normalizeThreadPreviewCandidate(input.preview);
    if (!normalizedPreview)
        return true;
    return normalizedPreview === normalizedThreadId;
}
/**
 * 从用户消息文本中提取第一条可用于标题的有效行。
 *
 * 规则：
 * - 跳过空行；
 * - 跳过纯 `[attachment] ...` 行；
 * - 返回第一条非空正文行。
 */
function extractFirstMeaningfulUserLine(text) {
    const normalizedText = String(text ?? "").replace(/\r\n/g, "\n");
    const lines = normalizedText.split("\n");
    for (const rawLine of lines) {
        const normalizedLine = rawLine.trim();
        if (!normalizedLine)
            continue;
        if (ATTACHMENT_LINE_REGEX.test(normalizedLine))
            continue;
        return normalizedLine;
    }
    return "";
}
/**
 * 按前端一致的语义把用户消息提取为线程标题。
 */
function deriveThreadPreviewFromUserMessageText(text) {
    const firstMeaningfulLine = extractFirstMeaningfulUserLine(text);
    if (!firstMeaningfulLine)
        return null;
    const normalizedSentence = firstMeaningfulLine.replace(/\s+/g, " ").trim();
    if (!normalizedSentence)
        return null;
    const sentenceEndMatch = /[。！？.!?]/.exec(normalizedSentence);
    const title = sentenceEndMatch ? normalizedSentence.slice(0, sentenceEndMatch.index + 1) : normalizedSentence;
    const normalizedTitle = title.trim();
    if (!normalizedTitle)
        return null;
    if (normalizedTitle.length <= DEFAULT_THREAD_TITLE_MAX_CHARS)
        return normalizedTitle;
    return `${normalizedTitle.slice(0, Math.max(0, DEFAULT_THREAD_TITLE_MAX_CHARS - 1)).trimEnd()}…`;
}
/**
 * 在“持久化 preview”与“CLI 新 preview”之间挑选更优标题。
 *
 * 规则：
 * - CLI preview 已经可读时优先使用 CLI；
 * - CLI preview 仍是占位值时，保留本地已有的可读标题；
 * - 都不可读时回退到原始 CLI 值，最终再回退到 threadId。
 */
function pickPreferredThreadPreview(input) {
    const normalizedIncomingPreview = normalizeThreadPreviewCandidate(input.incomingPreview);
    const normalizedPersistedPreview = normalizeThreadPreviewCandidate(input.persistedPreview);
    if (!isPlaceholderThreadPreview({ threadId: input.threadId, preview: normalizedIncomingPreview })) {
        return normalizedIncomingPreview;
    }
    if (!isPlaceholderThreadPreview({ threadId: input.threadId, preview: normalizedPersistedPreview })) {
        return normalizedPersistedPreview;
    }
    return normalizedIncomingPreview || normalizedPersistedPreview || normalizeThreadPreviewCandidate(input.threadId);
}
//# sourceMappingURL=threadPreviewTitle.js.map