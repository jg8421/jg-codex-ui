/**
 * 取消暂存（unstage）指定路径或全部已暂存内容。
 *
 * 语义：
 * - 传入 `paths`：仅对这些路径执行 `git restore --staged -- <paths...>`；
 * - 不传 `paths` 或为空：自动读取当前 index 中已暂存文件，并批量取消暂存；
 * - 不会回滚工作区内容，只影响暂存区（index）。
 */
export declare function unstageGitPaths(repoRoot: string, input: {
    paths?: string[];
}): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}>;
