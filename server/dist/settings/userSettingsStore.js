"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserSettingsStore = createUserSettingsStore;
const node_path_1 = __importDefault(require("node:path"));
const authDb_1 = require("../auth/sqlite/authDb");
const sqliteUserSettingsStore_1 = require("./sqliteUserSettingsStore");
/**
 * 解析用户配置仓库 SQLite 路径。
 */
function resolveUserSettingsStoreDbPath(opts) {
    const rawDbPath = String(opts.dbPath ?? opts.filePath ?? "").trim();
    if (!rawDbPath)
        throw new Error("user settings store dbPath is required");
    return node_path_1.default.resolve(rawDbPath);
}
/**
 * 创建用户配置仓库（当前默认使用 SQLite）。
 */
async function createUserSettingsStore(opts) {
    const authDb = opts.authDb ?? (0, authDb_1.createAuthDb)({ dbPath: resolveUserSettingsStoreDbPath(opts) });
    return (0, sqliteUserSettingsStore_1.createSqliteUserSettingsStore)({ authDb });
}
//# sourceMappingURL=userSettingsStore.js.map