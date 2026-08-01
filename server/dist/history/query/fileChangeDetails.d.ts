import type { RawEventRecord } from "../sqlite/sqliteHistoryStore";
/**
 * 历史 file_change 单文件条目（与 Web DiffBlock 所需字段保持一致）。
 */
export type HistoryFileChange = {
    path: string;
    kind: string;
    diff: string;
};
/**
 * 历史 file_change 详情结构：标题 + 文件列表 + 可选工具输出。
 */
export type HistoryFileChangeDetail = {
    title: string;
    changes: HistoryFileChange[];
    output?: string;
};
/**
 * 从 raw_events 重建 file_change 详情映射（messageId -> detail）。
 */
export declare function buildFileChangeDetailByMessageId(rawEvents: RawEventRecord[]): Map<string, HistoryFileChangeDetail>;
