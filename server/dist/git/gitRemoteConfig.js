"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGitRemoteNames = listGitRemoteNames;
exports.readGitRemoteUrl = readGitRemoteUrl;
exports.writeGitRemoteUrl = writeGitRemoteUrl;
const gitCommand_1 = require("./gitCommand");
/**
 * 列出当前仓库的 remote 名称列表（按 git 输出顺序返回）。
 */
async function listGitRemoteNames(repoRoot) {
    // out：`git remote` 输出，每行一个 remote 名。
    const out = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: ["remote"] });
    if (out.exitCode !== 0) {
        throw new Error(out.stderr || out.stdout || "git remote list failed");
    }
    // names：拆行并去空白。
    const names = String(out.stdout ?? "")
        .split(/\r?\n/g)
        .map((line) => String(line ?? "").trim())
        .filter(Boolean);
    // uniq：按顺序去重，避免异常输出导致重复。
    const uniq = [];
    const seen = new Set();
    for (const name of names) {
        if (seen.has(name))
            continue;
        seen.add(name);
        uniq.push(name);
    }
    return uniq;
}
/**
 * 读取指定 remote 的原始 URL；remote 不存在则返回 null。
 */
async function readGitRemoteUrl(repoRoot, remoteName) {
    // normalized：规范化 remoteName（仅 trim；更严格校验由路由层负责）。
    const normalized = String(remoteName ?? "").trim();
    if (!normalized)
        return null;
    // out：remote 不存在时 exitCode != 0。
    const out = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: ["remote", "get-url", normalized] });
    if (out.exitCode !== 0)
        return null;
    const url = String(out.stdout ?? "").trim();
    return url ? url : null;
}
/**
 * 写入指定 remote 的 URL：
 * - 存在则 set-url
 * - 不存在则 add
 */
async function writeGitRemoteUrl(repoRoot, input) {
    // remoteName：规范化 remote 名（更严格校验由路由层负责）。
    const remoteName = String(input.remoteName ?? "").trim();
    // urlToWrite：写入 `.git/config` 的 URL（应已在路由层完成脱敏与非空校验）。
    const urlToWrite = String(input.urlToWrite ?? "").trim();
    if (!remoteName)
        return { stdout: "", stderr: "remote name is required", exitCode: 1 };
    if (!urlToWrite)
        return { stdout: "", stderr: "url is required", exitCode: 1 };
    // existing：判断 remote 是否已存在。
    const existing = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: ["remote", "get-url", remoteName] });
    // args：根据是否存在，选择 set-url 或 add。
    const args = existing.exitCode === 0 ? ["remote", "set-url", remoteName, urlToWrite] : ["remote", "add", remoteName, urlToWrite];
    // out：执行写入动作。
    const out = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: [...args] });
    return { stdout: out.stdout, stderr: out.stderr, exitCode: out.exitCode };
}
//# sourceMappingURL=gitRemoteConfig.js.map