"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkspaceStatusStore = createWorkspaceStatusStore;
const node_path_1 = __importDefault(require("node:path"));
const authDb_1 = require("../auth/sqlite/authDb");
const sqliteWorkspaceStatusStore_1 = require("./sqliteWorkspaceStatusStore");
/**
 * 解析工作目录状态仓库 SQLite 路径。
 */
function resolveWorkspaceStatusStoreDbPath(options) {
    const rawDbPath = String(options.dbPath ?? "").trim();
    if (!rawDbPath)
        throw new Error("workspace status store dbPath is required");
    return node_path_1.default.resolve(rawDbPath);
}
/**
 * 创建工作目录状态仓库（当前默认使用 SQLite）。
 */
async function createWorkspaceStatusStore(options) {
    const authDb = options.authDb ?? (0, authDb_1.createAuthDb)({ dbPath: resolveWorkspaceStatusStoreDbPath(options) });
    return (0, sqliteWorkspaceStatusStore_1.createSqliteWorkspaceStatusStore)({ authDb });
}
//# sourceMappingURL=workspaceStatusStore.js.map