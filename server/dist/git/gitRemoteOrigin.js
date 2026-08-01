"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOriginRemoteUrl = getOriginRemoteUrl;
exports.getOriginRemoteTarget = getOriginRemoteTarget;
exports.sanitizeGitRemoteUrl = sanitizeGitRemoteUrl;
const gitCommand_1 = require("./gitCommand");
const gitRemoteUrl_1 = require("./gitRemoteUrl");
/**
 * 读取 origin remote 的原始 URL。
 */
async function getOriginRemoteUrl(repoRoot) {
    const out = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: ["remote", "get-url", "origin"] });
    if (out.exitCode !== 0)
        return null;
    const url = String(out.stdout ?? "").trim();
    return url ? url : null;
}
/**
 * 读取并解析 origin remote 的目标信息（protocol/host/username）。
 */
async function getOriginRemoteTarget(repoRoot) {
    const originUrl = await getOriginRemoteUrl(repoRoot);
    if (!originUrl)
        return null;
    return (0, gitRemoteUrl_1.parseGitRemoteUrl)(originUrl);
}
/**
 * 清洗远端 URL，避免把 username/password 写进 `.git/config`。
 *
 * 说明：
 * - 对 http(s)/ssh:// URL：若包含 username/password，自动剥离凭据后返回。
 * - 对 scp-like（git@host:org/repo.git）无法可靠剥离“口令”，保持原样。
 */
function sanitizeGitRemoteUrl(rawUrl) {
    const trimmed = String(rawUrl ?? "").trim();
    if (!trimmed)
        return { sanitizedUrl: "", changed: false };
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("ssh://")) {
        try {
            const parsedUrl = new URL(trimmed);
            const hadSecrets = Boolean(parsedUrl.username) || Boolean(parsedUrl.password);
            if (!hadSecrets)
                return { sanitizedUrl: trimmed, changed: false };
            parsedUrl.username = "";
            parsedUrl.password = "";
            return { sanitizedUrl: parsedUrl.toString(), changed: true };
        }
        catch {
            return { sanitizedUrl: trimmed, changed: false };
        }
    }
    return { sanitizedUrl: trimmed, changed: false };
}
//# sourceMappingURL=gitRemoteOrigin.js.map