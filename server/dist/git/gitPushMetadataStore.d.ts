import { type AuthDb } from "../auth/sqlite/authDb";
/**
 * 单次查询返回的“commit -> pushedAt”映射。
 */
export type GitPushedCommitMap = Map<string, string>;
/**
 * Git push 元数据仓库。
 */
export type GitPushMetadataStore = {
    /**
     * 查询指定仓库/分支/提交集合的 push 时间。
     */
    listPushedCommits(input: {
        repoRoot: string;
        branchName: string;
        commitHashes: string[];
    }): Promise<GitPushedCommitMap>;
    /**
     * 批量写入某次 push 成功对应的 commit 集合。
     */
    upsertPushedCommits(input: {
        repoRoot: string;
        branchName: string;
        commitHashes: string[];
        pushedAt: string;
    }): Promise<void>;
};
/**
 * Git push 元数据仓库创建参数。
 */
type CreateGitPushMetadataStoreOptions = {
    filePath?: string;
    dbPath?: string;
    authDb?: AuthDb;
};
/**
 * 创建基于 SQLite 的 Git push 元数据仓库。
 */
export declare function createGitPushMetadataStore(options: CreateGitPushMetadataStoreOptions): GitPushMetadataStore;
/**
 * 创建内存版 Git push 元数据仓库。
 */
export declare function createInMemoryGitPushMetadataStore(): GitPushMetadataStore;
export {};
