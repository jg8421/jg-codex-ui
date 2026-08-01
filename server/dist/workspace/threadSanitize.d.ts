/**
 * 仅用于“对外返回给前端的 thread payload”净化：剥离 Windows `\\?\` 前缀。
 *
 * 说明：
 * - 该函数是 best-effort：只处理 `cwd` 字段，不做深拷贝/深层 normalize；
 * - 主要用于兼容历史线程中已持久化的 `\\?\C:\...`，避免继续污染 UI 展示。
 */
export declare function sanitizeThreadForClient(thread: unknown): unknown;
