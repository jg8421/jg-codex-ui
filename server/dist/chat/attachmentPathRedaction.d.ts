/**
 * 将 `[attachment] <path>` 行脱敏为 `[attachment] <filename>`。
 * 注意：仅用于 UI 展示，不能影响真正发送给 codex 的原始文本。
 */
export declare function redactAttachmentPathsForDisplay(text: string): string;
