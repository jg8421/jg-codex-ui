/**
 * 仅依赖 `exec` 的 SQLite schema 初始化接口。
 */
type SqliteExecDb = {
    exec: (sql: string) => unknown;
};
/**
 * 初始化认证与工作区设置相关表结构。
 */
export declare function applyAuthSchema(db: SqliteExecDb): void;
export {};
