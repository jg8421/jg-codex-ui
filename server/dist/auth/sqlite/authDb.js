"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthDb = createAuthDb;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const schema_1 = require("./schema");
/**
 * 创建并初始化认证数据库连接。
 */
function createAuthDb(options) {
    const normalizedDbPath = node_path_1.default.resolve(String(options.dbPath ?? "").trim());
    if (!normalizedDbPath)
        throw new Error("auth dbPath is required");
    const dbDirPath = node_path_1.default.dirname(normalizedDbPath);
    node_fs_1.default.mkdirSync(dbDirPath, { recursive: true });
    const db = new better_sqlite3_1.default(normalizedDbPath);
    (0, schema_1.applyAuthSchema)(db);
    const transaction = db.transaction((callback) => callback());
    const runInTransaction = (callback) => transaction(callback);
    return { db, runInTransaction };
}
//# sourceMappingURL=authDb.js.map