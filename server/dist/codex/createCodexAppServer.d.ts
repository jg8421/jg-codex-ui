import { CodexAppServer } from "./codexAppServer";
/**
 * 按当前运行时配置创建 Codex app-server 实例。
 *
 * 说明：
 * - `cwd` 必须使用 `getCodexCwd()`，与线程解析、权限校验、MCP CLI 保持一致；
 * - 避免底层在缺失线程级 cwd 时回退到程序运行目录，导致跨工作区误写文件。
 */
export declare function createCodexAppServerFromEnv(): CodexAppServer;
