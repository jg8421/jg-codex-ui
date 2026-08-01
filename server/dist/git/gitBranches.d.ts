import type { GitBranchesSnapshot } from "./gitTypes";
/**
 * 获取 repo 的分支快照（local + remote）。
 *
 * 注意：
 * - 该函数只做 git 信息读取，不做权限与 repoRoot 解析；
 * - detached HEAD 时 `current` 通常为 "HEAD"。
 */
export declare function getGitBranchesSnapshot(repoRoot: string): Promise<GitBranchesSnapshot>;
/**
 * 获取分支名索引（便于校验用户输入 target/baseRef 是否存在）。
 */
export declare function getGitBranchNameIndex(repoRoot: string): Promise<{
    locals: Set<string>;
    remotes: Set<string>;
}>;
