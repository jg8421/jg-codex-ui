import { type ParsedGitRemoteTarget } from "./gitRemoteUrl";
/**
 * 读取 origin remote 的原始 URL。
 */
export declare function getOriginRemoteUrl(repoRoot: string): Promise<string | null>;
/**
 * 读取并解析 origin remote 的目标信息（protocol/host/username）。
 */
export declare function getOriginRemoteTarget(repoRoot: string): Promise<ParsedGitRemoteTarget | null>;
/**
 * 清洗远端 URL，避免把 username/password 写进 `.git/config`。
 *
 * 说明：
 * - 对 http(s)/ssh:// URL：若包含 username/password，自动剥离凭据后返回。
 * - 对 scp-like（git@host:org/repo.git）无法可靠剥离“口令”，保持原样。
 */
export declare function sanitizeGitRemoteUrl(rawUrl: string): {
    sanitizedUrl: string;
    changed: boolean;
};
