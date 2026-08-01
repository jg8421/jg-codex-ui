"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactAttachmentPathsForDisplay = redactAttachmentPathsForDisplay;
// ATTACHMENT_PREFIX_REGEX：匹配形如 `[attachment] <path>` 的单行附件标记（允许前置空白），并捕获“前缀”与“路径”两部分。
const ATTACHMENT_PREFIX_REGEX = /^(\s*\[attachment\]\s+)(.+)$/i;
/**
 * 从附件路径中提取文件名（basename）。
 */
function extractAttachmentFilename(rawAttachmentPath) {
    // Trim 并移除尾部分隔符，兼容 `/` 与 `\\`。
    const normalizedAttachmentPath = rawAttachmentPath.trim().replace(/[\\\\/]+$/g, "");
    if (!normalizedAttachmentPath)
        return "";
    const pathParts = normalizedAttachmentPath.split(/[\\\\/]/).filter(Boolean);
    if (!pathParts.length)
        return "";
    return pathParts[pathParts.length - 1] ?? "";
}
/**
 * 将附件路径转换为安全展示名（仅文件名）。
 */
function extractAttachmentDisplayName(rawAttachmentPath) {
    const attachmentFilename = extractAttachmentFilename(rawAttachmentPath);
    if (!attachmentFilename)
        return "attachment";
    return attachmentFilename;
}
/**
 * 解析一行 `[attachment] ...`，提取展示所需元数据。
 */
function parseAttachmentLineForDisplay(line) {
    const matchedAttachmentLine = line.match(ATTACHMENT_PREFIX_REGEX);
    if (!matchedAttachmentLine)
        return null;
    // 保留原始前缀，便于未来格式化扩展。
    const linePrefix = matchedAttachmentLine[1] ?? "[attachment] ";
    const rawAttachmentPath = String(matchedAttachmentLine[2] ?? "").trim();
    if (!rawAttachmentPath)
        return null;
    const attachmentFilename = extractAttachmentFilename(rawAttachmentPath);
    if (!attachmentFilename)
        return null;
    const attachmentDisplayName = extractAttachmentDisplayName(rawAttachmentPath);
    return {
        prefix: linePrefix,
        rawPath: rawAttachmentPath,
        filename: attachmentFilename,
        displayName: attachmentDisplayName,
    };
}
/**
 * 将 `[attachment] <path>` 行脱敏为 `[attachment] <filename>`。
 * 注意：仅用于 UI 展示，不能影响真正发送给 codex 的原始文本。
 */
function redactAttachmentPathsForDisplay(text) {
    if (!text.trim())
        return text;
    return text
        .split("\n")
        .map((line) => {
        const parsedAttachmentLine = parseAttachmentLineForDisplay(line);
        if (!parsedAttachmentLine)
            return line;
        return `${parsedAttachmentLine.prefix}${parsedAttachmentLine.displayName}`;
    })
        .join("\n");
}
//# sourceMappingURL=attachmentPathRedaction.js.map