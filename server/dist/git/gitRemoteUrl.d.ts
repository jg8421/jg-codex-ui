import type { GitCredentialProtocol } from "./gitCredentialTypes";
/**
 * 解析后的 Git 远端关键信息。
 */
export type ParsedGitRemoteTarget = {
    protocol: GitCredentialProtocol;
    host: string;
    username: string | null;
};
/**
 * 将原始 remote URL 解析为主机、协议与远端用户。
 */
export declare function parseGitRemoteUrl(remoteUrl: string): ParsedGitRemoteTarget | null;
/**
 * 读取仓库 origin remote URL 并解析为结构化目标。
 */
export declare function resolveGitRemoteTarget(repoRoot: string): Promise<ParsedGitRemoteTarget | null>;
