import type { SystemToolCallSummary } from "./types";
/**
 * 尝试把 system 文本解析为 CLI 风格的工具调用摘要。
 * 若结构不明显，返回 `null` 并由上层回退到普通文本渲染。
 */
export declare function parseSystemToolCallSummary(text: string): SystemToolCallSummary | null;
/**
 * 生成折叠态单行预览文本，避免结构化内容退化成冗长纯文本。
 */
export declare function buildSystemToolCallSummaryPreview(summary: SystemToolCallSummary): string;
