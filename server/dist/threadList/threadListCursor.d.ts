/**
 * 线程列表分页游标（稳定排序键）：
 * - updatedAt DESC
 * - createdAt DESC
 * - id ASC
 *
 * 说明：游标用于“从某条记录之后继续往后翻页”（下一页更旧）。
 */
export type ThreadListCursor = {
    updatedAt: number;
    createdAt: number;
    id: string;
};
/**
 * 将游标编码为可放入 URL query 的字符串（base64url(JSON)）。
 */
export declare function encodeThreadListCursor(cursor: ThreadListCursor): string;
/**
 * 从字符串解码游标；非法输入返回 null（而不是抛异常）。
 */
export declare function decodeThreadListCursor(encoded: string): ThreadListCursor | null;
