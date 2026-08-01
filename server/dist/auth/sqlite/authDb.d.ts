import Database from "better-sqlite3";
/**
 * 认证数据库句柄与事务工具。
 */
export type AuthDb = {
    db: Database.Database;
    runInTransaction: <T>(callback: () => T) => T;
};
/**
 * 创建认证数据库连接所需参数。
 */
export type CreateAuthDbOptions = {
    dbPath: string;
};
/**
 * 创建并初始化认证数据库连接。
 */
export declare function createAuthDb(options: CreateAuthDbOptions): AuthDb;
