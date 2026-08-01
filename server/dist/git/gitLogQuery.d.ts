import type { GitPushMetadataStore } from "./gitPushMetadataStore";
import type { GitLogItem } from "./gitTypes";
/**
 * Git log 查询结果；额外返回当前分支与 upstream，便于 push 成功后复用。
 */
export type GitLogQueryResult = {
    branchName: string;
    upstreamRef: string | null;
    items: GitLogItem[];
};
/**
 * 查询最近 Git 日志，并补充当前 upstream 视角下的推送状态。
 */
export declare function queryGitLogItems(input: {
    repoRoot: string;
    limit: number;
    pushMetadataStore?: GitPushMetadataStore | null;
}): Promise<GitLogQueryResult>;
/**
 * 获取当前分支名；detached HEAD 时返回 `HEAD`。
 */
export declare function resolveCurrentGitBranchName(repoRoot: string): Promise<string>;
/**
 * 获取当前分支的 upstream 引用；未配置时返回 null。
 */
export declare function resolveCurrentGitUpstreamRef(repoRoot: string): Promise<string | null>;
/**
 * 获取当前 HEAD commit hash；失败时返回 null。
 */
export declare function resolveCurrentGitHeadHash(repoRoot: string): Promise<string | null>;
/**
 * 列出当前分支相对 upstream 尚未推送的 commit hash 集合。
 */
export declare function listUnpushedCommitHashes(input: {
    repoRoot: string;
    upstreamRef: string | null;
}): Promise<string[]>;
