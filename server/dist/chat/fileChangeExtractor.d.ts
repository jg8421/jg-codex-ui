import type { FileChange } from "./types";
/**
 * 统计 unified diff 文本中的新增/删除行数（忽略 `+++`/`---` 头行）。
 */
export declare function countUnifiedDiffLineStats(diffText: string): {
    addedLines: number;
    deletedLines: number;
};
/**
 * 统计 diff 文本的新增/删除行数。
 *
 * 兼容两类输入：
 * 1. unified diff：按 `+` / `-` 变更行统计（忽略 `+++`/`---` 头行）。
 * 2. 纯文本（仅文件内容）：按文件变更类型(kind)兜底统计。
 */
export declare function countUnifiedDiffLineStatsWithKind(diffText: string, changeKind: string | undefined): {
    addedLines: number;
    deletedLines: number;
};
/**
 * 从未知对象中提取 file changes。
 */
export declare function extractFileChangesFromAny(raw: unknown): FileChange[];
