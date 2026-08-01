export type CwdSwitchLogPayload = {
    event: string;
} & Record<string, unknown>;
/**
 * 打印“cwd/工作目录切换”相关调试日志（默认关闭）。
 *
 * 用途：
 * - 排查前端传入 cwd、服务端 canonical 化后的 cwd、以及工作区鉴权/过滤链路。
 *
 * 开关：
 * - `CODEX_WEB_LOG_CWD_SWITCH=1`（或 true/on/yes）时启用。
 */
export declare function logCwdSwitch(payload: CwdSwitchLogPayload): void;
