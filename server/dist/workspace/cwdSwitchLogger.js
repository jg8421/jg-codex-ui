"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logCwdSwitch = logCwdSwitch;
const env_1 = require("../env");
/**
 * 打印“cwd/工作目录切换”相关调试日志（默认关闭）。
 *
 * 用途：
 * - 排查前端传入 cwd、服务端 canonical 化后的 cwd、以及工作区鉴权/过滤链路。
 *
 * 开关：
 * - `CODEX_WEB_LOG_CWD_SWITCH=1`（或 true/on/yes）时启用。
 */
function logCwdSwitch(payload) {
    if (!(0, env_1.getWebLogCwdSwitchEnabled)())
        return;
    const ts = new Date().toISOString();
    try {
        console.info(`[cwd-switch] ${ts} ${JSON.stringify(payload)}`);
    }
    catch {
        console.info(`[cwd-switch] ${ts} ${String(payload?.event ?? "unknown")}`);
    }
}
//# sourceMappingURL=cwdSwitchLogger.js.map