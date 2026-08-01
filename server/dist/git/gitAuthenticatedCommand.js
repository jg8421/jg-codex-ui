"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGitCommandWithCredential = runGitCommandWithCredential;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const gitCommand_1 = require("./gitCommand");
const gitRemoteUrl_1 = require("./gitRemoteUrl");
const gitAuthEnv_1 = require("./gitAuthEnv");
/**
 * 根据命令输入解析本次要使用的凭证；支持显式 credentialId 或按 remote 自动匹配。
 */
async function resolveMatchedCredentialForCommand(input) {
    const remoteTarget = await (0, gitRemoteUrl_1.resolveGitRemoteTarget)(input.repoRoot);
    if (!remoteTarget) {
        return { matchedCredential: null, credentialError: null };
    }
    const requestedCredentialId = String(input.credentialId ?? "").trim();
    if (requestedCredentialId) {
        const credential = await input.credentialStore.getCredentialById({
            username: input.username,
            credentialId: requestedCredentialId,
        });
        if (!credential) {
            return {
                matchedCredential: null,
                credentialError: { stdout: "", stderr: "git credential not found", exitCode: 1 },
            };
        }
        if (credential.metadata.host !== remoteTarget.host || credential.metadata.protocol !== remoteTarget.protocol) {
            return {
                matchedCredential: null,
                credentialError: { stdout: "", stderr: "git credential does not match origin remote", exitCode: 1 },
            };
        }
        return { matchedCredential: credential, credentialError: null };
    }
    const credential = await input.credentialStore.findCredentialForRemote({
        username: input.username,
        host: remoteTarget.host,
        protocol: remoteTarget.protocol,
    });
    return { matchedCredential: credential, credentialError: null };
}
/**
 * 用用户保存的 Git 凭证执行网络型 Git 命令；未命中凭证时回退普通执行。
 */
async function runGitCommandWithCredential(input) {
    const executeGitCommand = input.executeGitCommand ?? gitCommand_1.runGitCommand;
    const matchedCredentialStore = input.credentialStore ?? null;
    if (!matchedCredentialStore) {
        return executeGitCommand({
            cwd: input.repoRoot,
            args: input.args,
            timeoutMs: input.timeoutMs,
        });
    }
    const { matchedCredential, credentialError } = await resolveMatchedCredentialForCommand({
        repoRoot: input.repoRoot,
        username: input.username,
        credentialId: input.credentialId,
        credentialStore: matchedCredentialStore,
    });
    if (credentialError)
        return credentialError;
    if (!matchedCredential) {
        return executeGitCommand({
            cwd: input.repoRoot,
            args: input.args,
            timeoutMs: input.timeoutMs,
        });
    }
    const tmpDirPath = await promises_1.default.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), "codex-git-auth-"));
    const cleanupPaths = [];
    try {
        const builtAuthEnv = matchedCredential.secret.type === "https_pat"
            ? await (0, gitAuthEnv_1.buildHttpsGitAuthEnv)(tmpDirPath, matchedCredential.secret)
            : await (0, gitAuthEnv_1.buildSshGitAuthEnv)(tmpDirPath, matchedCredential.secret);
        cleanupPaths.push(...builtAuthEnv.cleanupPaths);
        return await executeGitCommand({
            cwd: input.repoRoot,
            args: input.args,
            timeoutMs: input.timeoutMs,
            env: builtAuthEnv.env,
        });
    }
    finally {
        for (const cleanupPath of cleanupPaths.reverse()) {
            await promises_1.default.rm(cleanupPath, { force: true });
        }
        await promises_1.default.rm(tmpDirPath, { recursive: true, force: true });
    }
}
//# sourceMappingURL=gitAuthenticatedCommand.js.map