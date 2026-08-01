"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGitCommand = runGitCommand;
const node_child_process_1 = require("node:child_process");
const commandLogger_1 = require("../tools/commandLogger");
/**
 * 以子进程方式运行 `git` 并收集 stdout/stderr。
 *
 * 约束：
 * - 始终使用 args 数组传参，禁止 shell 拼接，避免注入；
 * - 允许设置超时，避免某些网络操作（pull/push）卡死；
 * - 仅负责执行与收集输出，不负责解析与错误语义。
 */
async function runGitCommand(opts) {
    // timeoutMs：缺省 60s，最小 1s。
    const timeoutMs = typeof opts.timeoutMs === "number" && Number.isFinite(opts.timeoutMs) ? Math.max(1000, Math.floor(opts.timeoutMs)) : 60_000;
    return new Promise((resolve, reject) => {
        (0, commandLogger_1.logCommandExecution)({
            source: "git",
            command: "git",
            args: opts.args,
            cwd: opts.cwd,
        });
        // child：启动 git 子进程；windowsHide 避免弹窗。
        const child = (0, node_child_process_1.spawn)("git", opts.args, {
            cwd: opts.cwd,
            env: { ...process.env, ...(opts.env ?? {}) },
            stdio: "pipe",
            shell: false,
            windowsHide: true,
        });
        // stdout/stderr：累加输出，最终返回。
        let stdout = "";
        let stderr = "";
        // timeout：到时尝试 kill，避免长时间占用 worker。
        const timeout = setTimeout(() => {
            try {
                child.kill();
            }
            catch {
                // ignore
            }
        }, timeoutMs);
        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString("utf8");
        });
        child.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        child.on("close", (code) => {
            clearTimeout(timeout);
            const exitCode = typeof code === "number" ? code : 1;
            resolve({ stdout, stderr, exitCode });
        });
    });
}
//# sourceMappingURL=gitCommand.js.map