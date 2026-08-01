"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserWorkspaceStore = createUserWorkspaceStore;
const node_path_1 = __importDefault(require("node:path"));
const authDb_1 = require("../auth/sqlite/authDb");
const sqliteUserWorkspaceStore_1 = require("./sqliteUserWorkspaceStore");
/**
 * 解析用户工作目录仓库 SQLite 路径。
 */
function resolveUserWorkspaceStoreDbPath(opts) {
    const rawDbPath = String(opts.dbPath ?? opts.filePath ?? "").trim();
    if (!rawDbPath)
        throw new Error("user workspace store dbPath is required");
    return node_path_1.default.resolve(rawDbPath);
}
async function createUserWorkspaceStore(opts) {
    const authDb = opts.authDb ?? (0, authDb_1.createAuthDb)({ dbPath: resolveUserWorkspaceStoreDbPath(opts) });
    return (0, sqliteUserWorkspaceStore_1.createSqliteUserWorkspaceStore)({ authDb });
}
//# sourceMappingURL=userWorkspaceStore.js.map