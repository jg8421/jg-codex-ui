"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHttpsGitAuthEnv = buildHttpsGitAuthEnv;
exports.buildSshGitAuthEnv = buildSshGitAuthEnv;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
/**
 * 创建 askpass 脚本文件；用于 HTTPS 认证（username/token）。
 */
async function writeAskPassScript(tmpDirPath, envValueName) {
    const askPassScriptPath = node_path_1.default.join(tmpDirPath, `${envValueName.toLowerCase()}.js`);
    await promises_1.default.writeFile(askPassScriptPath, [
        "#!/usr/bin/env node",
        'const promptText = String(process.argv[2] ?? "").toLowerCase();',
        'if (promptText.includes("username")) {',
        '  process.stdout.write(String(process.env.CODEX_GIT_ASKPASS_USERNAME ?? ""));',
        "} else {",
        `  process.stdout.write(String(process.env.${envValueName} ?? ""));`,
        "}",
        "",
    ].join("\n"), { mode: 0o700 });
    await promises_1.default.chmod(askPassScriptPath, 0o700);
    return askPassScriptPath;
}
/**
 * 创建仅输出 SSH passphrase 的 askpass 脚本。
 */
async function writeSshAskPassScript(tmpDirPath) {
    const sshAskPassScriptPath = node_path_1.default.join(tmpDirPath, "ssh-askpass.js");
    await promises_1.default.writeFile(sshAskPassScriptPath, ["#!/usr/bin/env node", 'process.stdout.write(String(process.env.CODEX_GIT_SSH_PASSPHRASE ?? \"\"));', ""].join("\n"), { mode: 0o700 });
    await promises_1.default.chmod(sshAskPassScriptPath, 0o700);
    return sshAskPassScriptPath;
}
/**
 * 为 HTTPS 凭证构造单次 Git 命令所需环境变量。
 */
async function buildHttpsGitAuthEnv(tmpDirPath, secret) {
    const askPassScriptPath = await writeAskPassScript(tmpDirPath, "CODEX_GIT_ASKPASS_SECRET");
    return {
        env: {
            // 禁止交互式提示，避免 worker 卡住。
            GIT_TERMINAL_PROMPT: "0",
            GIT_ASKPASS: askPassScriptPath,
            CODEX_GIT_ASKPASS_USERNAME: secret.username,
            CODEX_GIT_ASKPASS_SECRET: secret.token,
        },
        cleanupPaths: [askPassScriptPath],
    };
}
/**
 * 为 SSH 私钥凭证构造单次 Git 命令所需环境变量。
 */
async function buildSshGitAuthEnv(tmpDirPath, secret) {
    const sshPrivateKeyPath = node_path_1.default.join(tmpDirPath, "git-ssh-key");
    await promises_1.default.writeFile(sshPrivateKeyPath, secret.privateKey, { mode: 0o600 });
    await promises_1.default.chmod(sshPrivateKeyPath, 0o600);
    const cleanupPaths = [sshPrivateKeyPath];
    const env = {
        // 禁止交互式提示，避免 worker 卡住。
        GIT_TERMINAL_PROMPT: "0",
        GIT_SSH_COMMAND: `ssh -i "${sshPrivateKeyPath}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`,
    };
    if (secret.passphrase) {
        const sshAskPassScriptPath = await writeSshAskPassScript(tmpDirPath);
        cleanupPaths.push(sshAskPassScriptPath);
        env.SSH_ASKPASS = sshAskPassScriptPath;
        env.SSH_ASKPASS_REQUIRE = "force";
        env.DISPLAY = process.env.DISPLAY || "codex-git-auth:0";
        env.CODEX_GIT_SSH_PASSPHRASE = secret.passphrase;
    }
    return { env, cleanupPaths };
}
//# sourceMappingURL=gitAuthEnv.js.map