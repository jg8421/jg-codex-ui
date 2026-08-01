/**
 * MCP server 配置列表项：结构由 Codex CLI 决定，这里保持宽松类型。
 * MCP server list item shape depends on Codex CLI; keep it as unknown.
 */
export type McpServerConfig = unknown;
/**
 * Codex MCP CLI 适配层：封装 `codex mcp ...` 的调用。
 */
export type CodexMcpCli = {
    listServers: () => Promise<McpServerConfig[]>;
    addUrlServer: (input: {
        name: string;
        url: string;
    }) => Promise<void>;
    removeServer: (input: {
        name: string;
    }) => Promise<void>;
};
/**
 * 创建 MCP CLI 调用器。
 */
export declare function createCodexMcpCli(opts: {
    codexBin: string;
    cwd: string;
}): CodexMcpCli;
