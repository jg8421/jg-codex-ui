"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCodexLaunchArgs = buildCodexLaunchArgs;
/**
 * 默认 app-server 启动参数。
 */
const DEFAULT_APP_SERVER_ARGS = ["app-server", "--listen", "stdio://"];
/**
 * 将字符串转成 TOML 单引号字符串字面量（literal string）。
 *
 * 说明：
 * - Windows 下通过 `cmd.exe` 启动时，双引号更容易被 shell 吞掉/重解释；
 * - 使用单引号 literal string 可降低跨平台启动时的参数转义风险。
 */
function toTomlStringLiteral(value) {
    // TOML literal string 内部若包含 `'`，需要用 `''` 表示一个单引号。
    // TOML literal strings represent a single quote as `''`.
    const escapedSingleQuote = value.replace(/'/g, "''");
    return `'${escapedSingleQuote}'`;
}
/**
 * 按 Codex CLI 约定构建最终启动参数。
 * 注意：全局 `-c` 参数必须位于子命令（如 `app-server`）之前。
 */
function buildCodexLaunchArgs(overrides) {
    const args = [];
    const historyPersistence = overrides.historyPersistence;
    const disableResponseStorage = overrides.disableResponseStorage;
    const baseArgs = overrides.baseArgs ?? DEFAULT_APP_SERVER_ARGS;
    if (historyPersistence !== undefined && historyPersistence !== null) {
        args.push("-c", `history.persistence=${toTomlStringLiteral(historyPersistence)}`);
    }
    if (disableResponseStorage !== undefined && disableResponseStorage !== null) {
        args.push("-c", `disable_response_storage=${String(disableResponseStorage)}`);
    }
    args.push(...baseArgs);
    return args;
}
//# sourceMappingURL=cliArgs.js.map