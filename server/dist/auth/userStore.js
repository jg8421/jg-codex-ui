"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserStore = createUserStore;
const node_path_1 = __importDefault(require("node:path"));
const authDb_1 = require("./sqlite/authDb");
const sqliteUserStore_1 = require("./sqlite/sqliteUserStore");
/**
 * 解析 user store 的 SQLite 路径。
 */
function resolveUserStoreDbPath(opts) {
    const rawDbPath = String(opts.dbPath ?? opts.filePath ?? "").trim();
    if (!rawDbPath)
        throw new Error("user store dbPath is required");
    return node_path_1.default.resolve(rawDbPath);
}
/**
 * 创建用户仓库（当前默认使用 SQLite）。
 */
async function createUserStore(opts) {
    const authDb = opts.authDb ?? (0, authDb_1.createAuthDb)({ dbPath: resolveUserStoreDbPath(opts) });
    return (0, sqliteUserStore_1.createSqliteUserStore)({ authDb });
}
//# sourceMappingURL=userStore.js.map