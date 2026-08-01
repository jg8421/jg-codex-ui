import { type ThreadListCursor } from "./threadListCursor";
/**
 * 线程列表分页默认条数。
 */
export declare const DEFAULT_THREAD_LIST_PAGE_LIMIT = 30;
/**
 * 线程列表分页最大条数：保护服务端与 SQLite，避免一次拉取过多。
 */
export declare const MAX_THREAD_LIST_PAGE_LIMIT = 200;
/**
 * 解析线程列表分页 limit 参数：
 * - 非法值回退默认
 * - 范围保护 1..MAX
 */
export declare function parseThreadListPageLimit(rawLimit: unknown, fallbackLimit?: number): number;
/**
 * 解析线程列表分页 cursor 参数：
 * - 空值返回 null（表示第一页）
 * - 非法值返回 "invalid"（供上层返回 400）
 */
export declare function parseThreadListCursor(rawCursor: unknown): ThreadListCursor | null | "invalid";
/**
 * 解析 includeThreadIds：
 * - 支持逗号分隔字符串
 * - 去重且保序
 * - 限制最大数量，避免 URL 过长或滥用
 */
export declare function parseIncludeThreadIds(raw: unknown, maxCount?: number): string[];
