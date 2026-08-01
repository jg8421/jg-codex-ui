"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWindowsPlatform = isWindowsPlatform;
exports.shouldUseShellForCodexBin = shouldUseShellForCodexBin;
exports.runCodexCommand = runCodexCommand;
const child_process_1 = require("child_process");
const commandLogger_1 = require("../tools/commandLogger");
/**
 * 判断当前运行环境是否为 Windows。
 * Determine whether current platform is Windows.
 */
function isWindowsPlatform() {
    return process.platform === "win32";
}
/**
 * 判断是否需要通过 shell 启动 codex。
 *
 * 说明：
 * - Windows 下如果 `codex` 是 npm shim，通常以 `codex.cmd`/`codex.bat` 形式存在；
 *   这类脚本需要 `cmd.exe` 参与解析，`shell: true` 更稳妥。
 * - 如果用户配置的是绝对路径（尤其包含空格，例如 `C:\\Program Files\\...\\codex.exe`），
 *   使用 shell 更容易遇到引号/空格解析问题，因此优先直接执行文件（`shell: false`）。
 *
 * Decide whether to use shell to launch Codex on Windows.
 */
function shouldUseShellForCodexBin(codexBin) {
    if (!isWindowsPlatform())
        return false;
    const trimmedBin = String(codexBin ?? "").trim();
    const lowerBin = trimmedBin.toLowerCase();
    // 显式 .cmd/.bat：必须走 shell。
    // Explicit .cmd/.bat: must use shell.
    if (lowerBin.endsWith(".cmd") || lowerBin.endsWith(".bat"))
        return true;
    // 绝对路径或包含路径分隔符：通常是可执行文件路径；优先不走 shell。
    // Absolute-ish or contains separators: typically an executable path; prefer no shell.
    const hasPathSeparator = trimmedBin.includes("\\") || trimmedBin.includes("/");
    const looksLikeDrivePath = /^[a-zA-Z]:/.test(trimmedBin);
    const looksLikeUncPath = trimmedBin.startsWith("\\\\");
    if (hasPathSeparator || looksLikeDrivePath || looksLikeUncPath)
        return false;
    // 纯命令名（如 `codex`）：让 shell 参与解析，以便命中 `codex.cmd`。
    // Bare command name (e.g. `codex`): use shell so `codex.cmd` can be resolved.
    return true;
}
/**
 * 以子进程方式运行 codex，并收集 stdout/stderr。
 * Run codex as a subprocess and collect stdout/stderr.
 */
async function runCodexCommand(opts) {
    // timeoutMs：显式传正整数时启用超时；传 `null` 表示禁用超时；未传时沿用通用 60s 默认值。
    const timeoutMs = opts.timeoutMs === null
        ? null
        : typeof opts.timeoutMs === "number" && Number.isFinite(opts.timeoutMs)
            ? Math.max(1000, Math.floor(opts.timeoutMs))
            : 60_000;
    return new Promise((resolve, reject) => {
        (0, commandLogger_1.logCommandExecution)({
            source: "codex-exec",
            command: opts.codexBin,
            args: opts.args,
            cwd: opts.cwd,
        });
        const child = (0, child_process_1.spawn)(opts.codexBin, opts.args, {
            cwd: opts.cwd,
            env: { ...process.env, ...(opts.env ?? {}) },
            stdio: "pipe",
            shell: shouldUseShellForCodexBin(opts.codexBin),
            windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        // timeout：仅在启用超时时才注册 kill 定时器。
        const timeout = typeof timeoutMs === "number"
            ? setTimeout(() => {
                try {
                    child.kill();
                }
                catch {
                    // ignore
                }
            }, timeoutMs)
            : null;
        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString("utf8");
        });
        child.on("error", (err) => {
            if (timeout)
                clearTimeout(timeout);
            reject(err);
        });
        child.on("close", (code) => {
            if (timeout)
                clearTimeout(timeout);
            const exitCode = typeof code === "number" ? code : 1;
            resolve({ stdout, stderr, exitCode });
        });
    });
}
//# sourceMappingURL=codexSpawn.js.map