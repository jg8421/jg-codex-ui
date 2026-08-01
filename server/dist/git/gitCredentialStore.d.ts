import { type AuthDb } from "../auth/sqlite/authDb";
import { type SqliteGitCredentialStore } from "./sqlite/sqliteGitCredentialStore";
export type GitCredentialStore = SqliteGitCredentialStore;
/**
 * Git 凭证仓库创建参数。
 */
type CreateGitCredentialStoreOptions = {
    filePath?: string;
    dbPath?: string;
    authDb?: AuthDb;
    masterKey?: string;
};
/**
 * 创建 Git 凭证仓库。
 */
export declare function createGitCredentialStore(options: CreateGitCredentialStoreOptions): Promise<GitCredentialStore>;
export {};
