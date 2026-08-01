/**
 * 判断给定 preview 是否仍是占位标题。
 *
 * 说明：
 * - 空字符串视为占位值；
 * - 与 threadId 完全相同的 preview 视为占位值；
 * - 其余 preview 认为是可展示标题。
 */
export declare function isPlaceholderThreadPreview(input: {
    threadId: string;
    preview: string;
}): boolean;
/**
 * 按前端一致的语义把用户消息提取为线程标题。
 */
export declare function deriveThreadPreviewFromUserMessageText(text: string): string | null;
/**
 * 在“持久化 preview”与“CLI 新 preview”之间挑选更优标题。
 *
 * 规则：
 * - CLI preview 已经可读时优先使用 CLI；
 * - CLI preview 仍是占位值时，保留本地已有的可读标题；
 * - 都不可读时回退到原始 CLI 值，最终再回退到 threadId。
 */
export declare function pickPreferredThreadPreview(input: {
    threadId: string;
    persistedPreview: string;
    incomingPreview: string;
}): string;
