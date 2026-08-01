/**
 * Web 监听参数解析结果。
 * Parsed result for web bind arguments.
 */
export type WebBindArgsParseResult = {
    /**
     * 监听 hostname；未传入或不合法时为 null。
     * Bind hostname; null when missing or invalid.
     */
    hostname: string | null;
    /**
     * 监听端口；未传入或不合法时为 null。
     * Bind port; null when missing or invalid.
     */
    port: number | null;
};
/**
 * 从 argv 中解析 `-hostname` / `--hostname` 与 `--prot` / `--port`。
 * Parse `-hostname` / `--hostname` and `--prot` / `--port` from argv.
 */
export declare function parseWebBindArgsFromArgv(argv: string[]): WebBindArgsParseResult;
/**
 * 将 argv 中解析到的 web bind 参数同步到环境变量。
 * Sync parsed web bind args into environment variables.
 */
export declare function applyWebBindArgsToEnv(argv: string[], env?: NodeJS.ProcessEnv): void;
