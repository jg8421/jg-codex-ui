/**
 * 校验新分支名是否合法（使用 git 原生命令，避免自行实现复杂规则）。
 */
export declare function assertValidNewBranchName(repoRoot: string, branchName: string): Promise<void>;
/**
 * 切换到指定分支。
 *
 * 支持：
 * - local：`git switch <target>`
 * - remote：若本地已存在同名分支则切换之，否则 `git switch --track <remote>`
 */
export declare function switchToGitBranch(repoRoot: string, target: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}>;
/**
 * 新建分支并切换到新分支。
 *
 * 规则：
 * - baseRef 默认 "HEAD"
 * - trackUpstream 仅在 baseRef 为远程分支（origin/*）时生效
 */
export declare function createAndSwitchGitBranch(repoRoot: string, input: {
    newBranch: string;
    baseRef: "HEAD" | string;
    trackUpstream: boolean;
}): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}>;
