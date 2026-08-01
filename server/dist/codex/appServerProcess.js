"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppServerProcess = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
const jsonl_1 = require("./jsonl");
const cliArgs_1 = require("./cliArgs");
const codexSpawn_1 = require("./codexSpawn");
const commandLogger_1 = require("../tools/commandLogger");
class AppServerProcess extends events_1.EventEmitter {
    child;
    decoder = new jsonl_1.JsonlDecoder();
    constructor(opts) {
        super();
        const args = (0, cliArgs_1.buildCodexLaunchArgs)({
            baseArgs: opts.args,
            historyPersistence: opts.historyPersistence,
            disableResponseStorage: opts.disableResponseStorage,
        });
        (0, commandLogger_1.logCommandExecution)({
            source: "codex-app-server",
            command: opts.codexBin,
            args,
            cwd: opts.cwd,
        });
        this.child = (0, child_process_1.spawn)(opts.codexBin, args, {
            cwd: opts.cwd,
            env: { ...process.env, ...opts.env },
            stdio: "pipe",
            // Windows 下按 `CODEX_BIN` 形态决定是否启用 shell：
            // - 命令名：启用 shell（兼容 `codex.cmd`）
            // - 路径：禁用 shell（避免空格/引号解析问题）
            // Decide shell usage on Windows based on `CODEX_BIN` shape.
            shell: (0, codexSpawn_1.shouldUseShellForCodexBin)(opts.codexBin),
            // 避免在 Windows 上弹出多余窗口（best-effort）。
            // Best-effort: avoid extra console windows on Windows.
            windowsHide: true,
        });
        this.child.stdout.on("data", (chunk) => {
            let messages = [];
            try {
                messages = this.decoder.push(chunk);
            }
            catch (err) {
                this.emit("stderr", `[codex app-server stdout parse error] ${String(err)}`);
                return;
            }
            for (const msg of messages)
                this.emit("message", msg);
        });
        this.child.stderr.on("data", (chunk) => {
            this.emit("stderr", chunk.toString("utf8"));
        });
        this.child.on("error", (err) => {
            this.emit("stderr", `[codex app-server error] ${String(err)}`);
        });
        this.child.on("exit", (code, signal) => {
            this.emit("exit", code, signal);
        });
    }
    send(message) {
        this.child.stdin.write(`${JSON.stringify(message)}\n`);
    }
    dispose() {
        this.child.kill();
    }
    on(event, listener) {
        return super.on(event, listener);
    }
}
exports.AppServerProcess = AppServerProcess;
//# sourceMappingURL=appServerProcess.js.map