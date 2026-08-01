/**
 * config 启动参数解析结果。
 * Parsed result for config startup argument.
 */
export type ConfigArgParseResult = {
    /**
     * 解析出的配置值；未传入时为 null。
     * Parsed config value; null when not provided.
     */
    configValue: string | null;
};
/**
 * 从 argv 中解析 `--config` / `---config` 参数。
 * Parse `--config` / `---config` from argv.
 */
export declare function parseConfigArgFromArgv(argv: string[]): ConfigArgParseResult;
/**
 * 将 argv 中的 config 参数同步到环境变量 `CODEX_CONFIG`。
 * Sync parsed config arg into env var `CODEX_CONFIG`.
 */
export declare function applyConfigArgToEnv(argv: string[], env?: NodeJS.ProcessEnv): void;
