export type RunGitCommandResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
};
/**
 * 以子进程方式运行 `git` 并收集 stdout/stderr。
 *
 * 约束：
 * - 始终使用 args 数组传参，禁止 shell 拼接，避免注入；
 * - 允许设置超时，避免某些网络操作（pull/push）卡死；
 * - 仅负责执行与收集输出，不负责解析与错误语义。
 */
export declare function runGitCommand(opts: {
    cwd: string;
    args: string[];
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
}): Promise<RunGitCommandResult>;
