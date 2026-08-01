"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestCodexStderrLine = getLatestCodexStderrLine;
exports.isIgnorableCodexRuntimeWarning = isIgnorableCodexRuntimeWarning;
/**
 * 从原始 stderr chunk 中提取最后一个非空行，便于状态缓存与告警识别复用同一份解析逻辑。
 */
function getLatestCodexStderrLine(raw) {
    // normalizedLines：仅保留非空行，避免 chunk 里尾部换行导致的空字符串污染状态。
    const normalizedLines = String(raw ?? "")
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean);
    return normalizedLines.at(-1) ?? "";
}
/**
 * 判断当前 stderr 单行是否属于“已知可恢复、无需展示”的 codex 运行时告警。
 */
function isIgnorableCodexRuntimeWarning(stderrLine) {
    // normalizedLine：统一转小写并去首尾空白，避免大小写或时间戳前缀影响匹配。
    const normalizedLine = String(stderrLine ?? "").trim().toLowerCase();
    if (!normalizedLine)
        return false;
    return (normalizedLine.includes("could not find system bubblewrap") &&
        normalizedLine.includes("will use the vendored bubblewrap in the meantime"));
}
//# sourceMappingURL=codexRuntimeStderr.js.map