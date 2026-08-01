"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGitCredentialStore = createGitCredentialStore;
const node_path_1 = __importDefault(require("node:path"));
const authSecretStore_1 = require("../auth/sqlite/authSecretStore");
const authDb_1 = require("../auth/sqlite/authDb");
const sqliteGitCredentialStore_1 = require("./sqlite/sqliteGitCredentialStore");
/**
 * Git 凭证主密钥在 auth_server_secrets 表中的固定 key。
 */
const GIT_CREDENTIAL_MASTER_KEY_SECRET_KEY = "git_credentials_master_key";
/**
 * 解析 Git 凭证仓库使用的 SQLite 路径。
 */
function resolveGitCredentialStoreDbPath(options) {
    const rawDbPath = String(options.dbPath ?? options.filePath ?? "").trim();
    if (!rawDbPath)
        throw new Error("git credential store dbPath is required");
    return node_path_1.default.resolve(rawDbPath);
}
/**
 * 解析 Git 凭证仓库使用的主密钥。
 */
function resolveGitCredentialStoreMasterKey(options, authDb) {
    // configuredMasterKey：兼容显式传入主密钥的旧调用方；未传时走数据库内生成。
    const configuredMasterKey = String(options.masterKey ?? "").trim();
    if (configuredMasterKey)
        return configuredMasterKey;
    // secretStore：内部服务端 secret 仓库，用于持久化 Git 主密钥。
    const secretStore = (0, authSecretStore_1.createAuthSecretStore)(authDb);
    return secretStore.getOrCreateSecret(GIT_CREDENTIAL_MASTER_KEY_SECRET_KEY);
}
/**
 * 创建 Git 凭证仓库。
 */
async function createGitCredentialStore(options) {
    const authDb = options.authDb ?? (0, authDb_1.createAuthDb)({ dbPath: resolveGitCredentialStoreDbPath(options) });
    return (0, sqliteGitCredentialStore_1.createSqliteGitCredentialStore)({
        authDb,
        masterKey: resolveGitCredentialStoreMasterKey(options, authDb),
    });
}
//# sourceMappingURL=gitCredentialStore.js.map