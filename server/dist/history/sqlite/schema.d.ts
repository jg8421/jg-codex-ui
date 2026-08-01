/**
 * schema 初始化仅依赖 `exec` 能力，使用最小接口避免类型命名空间差异导致编译失败。
 */
type SqliteExecDatabase = {
    exec: (sql: string) => unknown;
};
/**
 * 初始化历史数据库表结构与常用索引。
 */
export declare function applyHistorySchema(db: SqliteExecDatabase): void;
export {};
