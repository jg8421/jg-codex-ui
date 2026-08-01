"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripWindowsVerbatimPathPrefix = stripWindowsVerbatimPathPrefix;
exports.ensureWindowsVerbatimPathPrefix = ensureWindowsVerbatimPathPrefix;
exports.coerceCwdForCodex = coerceCwdForCodex;
const node_path_1 = __importDefault(require("node:path"));
/**
 * 将 Windows 的 verbatim/extended-length 路径前缀转换为普通路径形式。
 *
 * 背景：在 Windows 原生 Node 环境中，`fs.realpath()` 可能返回 `\\?\C:\...` 或 `\\?\UNC\...`，
 * 这会污染会话的 `cwd` 展示与路径比较。此函数只做“前缀剥离”，避免引入额外的语义变化。
 */
function stripWindowsVerbatimPathPrefix(rawPath) {
    // 输入字符串（保持 best-effort，不抛异常）。
    const inputPath = String(rawPath ?? "");
    // Windows verbatim 前缀：`\\?\`
    const verbatimPrefix = "\\\\?\\";
    // Windows verbatim UNC 前缀：`\\?\UNC\server\share\...`
    const verbatimUncPrefix = "\\\\?\\UNC\\";
    if (inputPath.startsWith(verbatimUncPrefix)) {
        // `\\?\UNC\server\share\dir` -> `\\server\share\dir`
        const uncTail = inputPath.slice(verbatimUncPrefix.length);
        return `\\\\${uncTail}`;
    }
    if (inputPath.startsWith(verbatimPrefix)) {
        // `\\?\C:\dir` -> `C:\dir`
        return inputPath.slice(verbatimPrefix.length);
    }
    return inputPath;
}
/**
 * 将 Windows 绝对路径转换为 verbatim/extended-length 形式（`\\?\` / `\\?\UNC\`）。
 *
 * 用途：`codex` CLI 在 Windows 下可能以 verbatim 形式持久化 cwd/历史记录；
 * 为了稳定命中同一历史存储，本项目在与 codex 交互时需要确保 cwd 带上该前缀。
 *
 * 注意：该函数只负责“加前缀”，不保证路径存在，也不做 realpath。
 */
function ensureWindowsVerbatimPathPrefix(rawPath) {
    // 输入路径（best-effort）。
    const inputPath = String(rawPath ?? "");
    if (!inputPath)
        return inputPath;
    // 已经是 verbatim 形式时直接返回。
    const verbatimPrefix = "\\\\?\\";
    if (inputPath.startsWith(verbatimPrefix))
        return inputPath;
    // 将 `/` 统一为 `\`，避免 `toNamespacedPath` 对分隔符差异处理不一致。
    const withBackslashes = inputPath.replace(/\//g, "\\");
    // UNC 路径（`\\server\share`）与盘符路径（`C:\dir`）才需要 verbatim 前缀；相对路径保持不变。
    const isUncPath = withBackslashes.startsWith("\\\\");
    const isDriveAbsolutePath = /^[a-zA-Z]:\\/.test(withBackslashes);
    if (!isUncPath && !isDriveAbsolutePath)
        return inputPath;
    // `path.win32.toNamespacedPath` 会按语义生成 `\\?\` 或 `\\?\UNC\` 前缀。
    // 这里不做 normalize，以避免改变 caller 的大小写/分隔符偏好。
    const namespaced = node_path_1.default.win32.toNamespacedPath(withBackslashes);
    return String(namespaced ?? withBackslashes);
}
/**
 * 将 “权限校验通过后的 cwd” 转换为 “传给 codex 的 cwd”。
 *
 * - Windows：返回 verbatim 路径（确保命中 codex 历史存储）。
 * - 非 Windows：原样返回。
 */
function coerceCwdForCodex(cwd, platform = process.platform) {
    // 输入 cwd（best-effort）。
    const rawCwd = String(cwd ?? "");
    if (!rawCwd)
        return rawCwd;
    // 平台名（允许测试注入）。
    const normalizedPlatform = String(platform ?? "").trim().toLowerCase();
    if (normalizedPlatform !== "win32")
        return rawCwd;
    return ensureWindowsVerbatimPathPrefix(rawCwd);
}
//# sourceMappingURL=windowsVerbatimPath.js.map