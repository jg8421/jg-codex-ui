import type { TextMetrics } from "./types";
/**
 * 统计纯文本行数，避免高频 split 带来的额外分配。
 */
export declare function countLines(text: string): number;
/**
 * 返回文本的字符数与行数，用于折叠阈值判定。
 */
export declare function getTextMetrics(text: string): TextMetrics;
