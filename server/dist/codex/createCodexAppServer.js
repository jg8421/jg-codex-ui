"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCodexAppServerFromEnv = createCodexAppServerFromEnv;
const env_1 = require("../env");
const codexAppServer_1 = require("./codexAppServer");
/**
 * 按当前运行时配置创建 Codex app-server 实例。
 *
 * 说明：
 * - `cwd` 必须使用 `getCodexCwd()`，与线程解析、权限校验、MCP CLI 保持一致；
 * - 避免底层在缺失线程级 cwd 时回退到程序运行目录，导致跨工作区误写文件。
 */
function createCodexAppServerFromEnv() {
    /**
     * app-server 启动目录：必须与运行时配置的 Codex 工作目录一致。
     */
    const codexRuntimeCwd = (0, env_1.getCodexCwd)();
    return new codexAppServer_1.CodexAppServer({
        codexBin: (0, env_1.getCodexBin)(),
        cwd: codexRuntimeCwd,
        historyPersistence: (0, env_1.getCodexHistoryPersistence)(),
        disableResponseStorage: (0, env_1.getCodexDisableResponseStorage)(),
        appServerArgs: (0, env_1.getCodexAppServerArgs)(),
    });
}
//# sourceMappingURL=createCodexAppServer.js.map