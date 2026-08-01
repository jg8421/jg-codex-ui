"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGitRemoteUrl = parseGitRemoteUrl;
exports.resolveGitRemoteTarget = resolveGitRemoteTarget;
const gitCommand_1 = require("./gitCommand");
/**
 * 解析 scp-like SSH remote URL。
 *
 * 支持：
 * - `git@github.com:org/repo.git`
 * - `github-work:org/repo.git`
 *
 * 约束：
 * - 不把 `C:\repo` 这类 Windows 本地路径误判成 SSH remote；
 * - host 统一转小写；
 * - 用户名缺失时返回 null。
 */
function parseScpLikeGitRemoteUrl(remoteUrl) {
    // isWindowsAbsolutePath：Windows 盘符绝对路径不应被误判为 SSH remote。
    const isWindowsAbsolutePath = /^[a-zA-Z]:[\\/]/.test(remoteUrl);
    if (isWindowsAbsolutePath)
        return null;
    // scpLikeWithUserMatch：匹配 `user@host:path`。
    const scpLikeWithUserMatch = remoteUrl.match(/^([^@:/\s]+)@([^:/\s]+):([^\s\\].+)$/);
    if (scpLikeWithUserMatch) {
        // username：scp-like SSH 用户名。
        const username = String(scpLikeWithUserMatch[1] ?? "").trim();
        // host：scp-like SSH 主机名或 SSH config alias。
        const host = String(scpLikeWithUserMatch[2] ?? "").trim().toLowerCase();
        if (!host)
            return null;
        return {
            protocol: "ssh",
            username: username || null,
            host,
        };
    }
    // scpLikeHostOnlyMatch：匹配 `host:path`，常见于依赖 SSH config alias 的写法。
    const scpLikeHostOnlyMatch = remoteUrl.match(/^([^@:/\s]+):([^\s\\].+)$/);
    if (!scpLikeHostOnlyMatch)
        return null;
    // host：scp-like SSH 主机名或 SSH config alias。
    const host = String(scpLikeHostOnlyMatch[1] ?? "").trim().toLowerCase();
    if (!host)
        return null;
    return {
        protocol: "ssh",
        username: null,
        host,
    };
}
/**
 * 将原始 remote URL 解析为主机、协议与远端用户。
 */
function parseGitRemoteUrl(remoteUrl) {
    const normalizedRemoteUrl = String(remoteUrl ?? "").trim();
    if (!normalizedRemoteUrl)
        return null;
    if (normalizedRemoteUrl.startsWith("http://") || normalizedRemoteUrl.startsWith("https://")) {
        try {
            const parsedUrl = new URL(normalizedRemoteUrl);
            return {
                protocol: "https",
                host: parsedUrl.hostname.trim().toLowerCase(),
                username: parsedUrl.username ? parsedUrl.username.trim() : null,
            };
        }
        catch {
            return null;
        }
    }
    if (normalizedRemoteUrl.startsWith("ssh://")) {
        try {
            const parsedUrl = new URL(normalizedRemoteUrl);
            return {
                protocol: "ssh",
                host: parsedUrl.hostname.trim().toLowerCase(),
                username: parsedUrl.username ? parsedUrl.username.trim() : null,
            };
        }
        catch {
            return null;
        }
    }
    return parseScpLikeGitRemoteUrl(normalizedRemoteUrl);
}
/**
 * 读取仓库 origin remote URL 并解析为结构化目标。
 */
async function resolveGitRemoteTarget(repoRoot) {
    const remoteUrlResult = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["remote", "get-url", "origin"],
    });
    if (remoteUrlResult.exitCode !== 0)
        return null;
    return parseGitRemoteUrl(remoteUrlResult.stdout);
}
//# sourceMappingURL=gitRemoteUrl.js.map