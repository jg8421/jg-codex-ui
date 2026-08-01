import { type RunGitCommandResult } from "./gitCommand";
import type { GitCredentialStore } from "./gitCredentialStore";
/**
 * Git 认证命令执行输入。
 */
export type GitAuthenticatedCommandInput = {
    repoRoot: string;
    username: string;
    args: string[];
    credentialId?: string;
    timeoutMs?: number;
};
/**
 * 可注入的 Git 认证执行器。
 */
export type GitAuthenticatedCommandRunner = (input: GitAuthenticatedCommandInput) => Promise<RunGitCommandResult>;
/**
 * 内部可注入执行器参数；测试可替换为 fake executor。
 */
type ExecuteGitCommandInput = {
    cwd: string;
    args: string[];
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
};
/**
 * 带可选 Git 凭证仓库的默认认证执行输入。
 */
type RunGitCommandWithCredentialInput = GitAuthenticatedCommandInput & {
    credentialStore?: Pick<GitCredentialStore, "findCredentialForRemote" | "getCredentialById"> | null;
    executeGitCommand?: (input: ExecuteGitCommandInput) => Promise<RunGitCommandResult>;
};
/**
 * 用用户保存的 Git 凭证执行网络型 Git 命令；未命中凭证时回退普通执行。
 */
export declare function runGitCommandWithCredential(input: RunGitCommandWithCredentialInput): Promise<RunGitCommandResult>;
export {};
