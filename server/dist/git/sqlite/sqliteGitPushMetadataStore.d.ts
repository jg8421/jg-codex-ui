import type { AuthDb } from "../../auth/sqlite/authDb";
import type { GitPushMetadataStore } from "../gitPushMetadataStore";
/**
 * SQLite Git push 元数据仓库创建参数。
 */
export type CreateSqliteGitPushMetadataStoreOptions = {
    authDb: AuthDb;
};
/**
 * 基于 SQLite 创建 Git push 元数据仓库。
 */
export declare function createSqliteGitPushMetadataStore(options: CreateSqliteGitPushMetadataStoreOptions): GitPushMetadataStore;
