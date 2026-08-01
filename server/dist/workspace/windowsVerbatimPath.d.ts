/**
 * 将 Windows 的 verbatim/extended-length 路径前缀转换为普通路径形式。
 *
 * 背景：在 Windows 原生 Node 环境中，`fs.realpath()` 可能返回 `\\?\C:\...` 或 `\\?\UNC\...`，
 * 这会污染会话的 `cwd` 展示与路径比较。此函数只做“前缀剥离”，避免引入额外的语义变化。
 */
export declare function stripWindowsVerbatimPathPrefix(rawPath: string): string;
/**
 * 将 Windows 绝对路径转换为 verbatim/extended-length 形式（`\\?\` / `\\?\UNC\`）。
 *
 * 用途：`codex` CLI 在 Windows 下可能以 verbatim 形式持久化 cwd/历史记录；
 * 为了稳定命中同一历史存储，本项目在与 codex 交互时需要确保 cwd 带上该前缀。
 *
 * 注意：该函数只负责“加前缀”，不保证路径存在，也不做 realpath。
 */
export declare function ensureWindowsVerbatimPathPrefix(rawPath: string): string;
/**
 * 将 “权限校验通过后的 cwd” 转换为 “传给 codex 的 cwd”。
 *
 * - Windows：返回 verbatim 路径（确保命中 codex 历史存储）。
 * - 非 Windows：原样返回。
 */
export declare function coerceCwdForCodex(cwd: string, platform?: string): string;
