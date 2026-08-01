/**
 * 列出当前仓库的 remote 名称列表（按 git 输出顺序返回）。
 */
export declare function listGitRemoteNames(repoRoot: string): Promise<string[]>;
/**
 * 读取指定 remote 的原始 URL；remote 不存在则返回 null。
 */
export declare function readGitRemoteUrl(repoRoot: string, remoteName: string): Promise<string | null>;
/**
 * 写入指定 remote 的 URL：
 * - 存在则 set-url
 * - 不存在则 add
 */
export declare function writeGitRemoteUrl(repoRoot: string, input: {
    remoteName: string;
    urlToWrite: string;
}): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}>;
