"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCodexMcpCli = createCodexMcpCli;
const codexSpawn_1 = require("./codexSpawn");
/**
 * 尝试从 stdout 中解析 JSON。
 *
 * 说明：
 * - `codex mcp list --json` 理论上只输出 JSON；
 * - 但在某些环境下可能仍夹杂 warning（通常在 stderr），这里做 best-effort 提取。
 */
function parseJsonFromStdout(stdout) {
    const trimmed = String(stdout ?? "").trim();
    if (!trimmed)
        return null;
    try {
        return JSON.parse(trimmed);
    }
    catch {
        // Best-effort: 尝试从最后一行提取 JSON。
        const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i -= 1) {
            const line = lines[i];
            if (!line.startsWith("{") && !line.startsWith("["))
                continue;
            try {
                return JSON.parse(line);
            }
            catch {
                // ignore
            }
        }
        return null;
    }
}
/**
 * 从 `codex mcp list` 的文本输出中尽力解析 server name 列表。
 *
 * 说明：
 * - 官方文档中 `codex mcp list` 未承诺 `--json` 一定存在，因此这里提供纯文本回退解析；
 * - 解析规则是 best-effort：优先匹配常见的 `Server: <name>` 与 `<name>:` 形式；
 * - 解析失败时返回单条记录，保留原始输出供 UI 只读展示。
 */
function parseServersFromTextOutput(stdout) {
    const trimmed = String(stdout ?? "").trim();
    if (!trimmed)
        return [];
    const lines = trimmed.split(/\r?\n/);
    const seen = new Set();
    const servers = [];
    const push = (name, text) => {
        const normalizedName = String(name ?? "").trim();
        if (!normalizedName)
            return;
        if (seen.has(normalizedName))
            return;
        seen.add(normalizedName);
        servers.push({ name: normalizedName, text });
    };
    for (const rawLine of lines) {
        const line = String(rawLine ?? "");
        const trimmedLine = line.trim();
        if (!trimmedLine)
            continue;
        // 常见格式：`Server: openaiDeveloperDocs`
        const serverMatch = trimmedLine.match(/\bServer:\s*([A-Za-z0-9_.-]+)\b/i);
        if (serverMatch?.[1]) {
            push(serverMatch[1], line);
            continue;
        }
        // 常见格式：`openaiDeveloperDocs: ...`（或仅 `openaiDeveloperDocs:`）
        const colonMatch = trimmedLine.match(/^([A-Za-z0-9_.-]+)\s*:/);
        if (colonMatch?.[1]) {
            push(colonMatch[1], line);
            continue;
        }
        // 常见格式：`- openaiDeveloperDocs (...)`
        const bulletMatch = trimmedLine.match(/^[-*•]\s*([A-Za-z0-9_.-]+)\b/);
        if (bulletMatch?.[1]) {
            push(bulletMatch[1], line);
            continue;
        }
    }
    if (servers.length)
        return servers;
    return [{ name: "", text: trimmed }];
}
/**
 * 创建 MCP CLI 调用器。
 */
function createCodexMcpCli(opts) {
    const codexBin = String(opts.codexBin ?? "").trim() || "codex";
    const cwd = String(opts.cwd ?? "").trim() || process.cwd();
    return {
        async listServers() {
            // 优先使用 JSON 输出：更稳定、也更便于 UI 展示。
            const jsonResult = await (0, codexSpawn_1.runCodexCommand)({ codexBin, args: ["mcp", "list", "--json"], cwd });
            const parsed = jsonResult.exitCode === 0 ? parseJsonFromStdout(jsonResult.stdout) : null;
            if (Array.isArray(parsed))
                return parsed;
            // 回退到纯文本 list：兼容不支持 `--json` 的版本。
            const textResult = await (0, codexSpawn_1.runCodexCommand)({ codexBin, args: ["mcp", "list"], cwd });
            if (textResult.exitCode !== 0) {
                const details = textResult.stderr?.trim() || textResult.stdout?.trim() || `exitCode=${textResult.exitCode}`;
                throw new Error(`codex mcp list failed: ${details}`);
            }
            return parseServersFromTextOutput(textResult.stdout);
        },
        async addUrlServer(input) {
            const name = String(input?.name ?? "").trim();
            const url = String(input?.url ?? "").trim();
            if (!name || !url)
                throw new Error("name and url are required");
            const result = await (0, codexSpawn_1.runCodexCommand)({ codexBin, args: ["mcp", "add", name, "--url", url], cwd });
            if (result.exitCode !== 0) {
                const details = result.stderr?.trim() || result.stdout?.trim() || `exitCode=${result.exitCode}`;
                throw new Error(`codex mcp add failed: ${details}`);
            }
        },
        async removeServer(input) {
            const name = String(input?.name ?? "").trim();
            if (!name)
                throw new Error("name is required");
            const result = await (0, codexSpawn_1.runCodexCommand)({ codexBin, args: ["mcp", "remove", name], cwd });
            if (result.exitCode !== 0) {
                const details = result.stderr?.trim() || result.stdout?.trim() || `exitCode=${result.exitCode}`;
                throw new Error(`codex mcp remove failed: ${details}`);
            }
        },
    };
}
//# sourceMappingURL=codexMcpCli.js.map