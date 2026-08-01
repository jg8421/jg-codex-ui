"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthSecretStore = createAuthSecretStore;
const node_crypto_1 = __importDefault(require("node:crypto"));
/**
 * 规范化内部 secret key。
 */
function normalizeAuthSecretKey(secretKey) {
    return String(secretKey ?? "").trim();
}
/**
 * 生成随机 secret 值；使用 base64url 便于直接写入 SQLite 与日志外展示。
 */
function generateRandomSecretValue() {
    return node_crypto_1.default.randomBytes(32).toString("base64url");
}
/**
 * 基于认证数据库创建内部 secret 仓库。
 */
function createAuthSecretStore(authDb) {
    // db：底层 SQLite 连接，用于复用 prepared statement。
    const db = authDb.db;
    const getSecretStatement = db.prepare(`
    SELECT secret_value
    FROM auth_server_secrets
    WHERE secret_key = ?
    LIMIT 1
  `);
    const insertSecretStatement = db.prepare(`
    INSERT INTO auth_server_secrets (
      secret_key,
      secret_value,
      created_at_ms,
      updated_at_ms
    ) VALUES (
      @secretKey,
      @secretValue,
      @createdAtMs,
      @updatedAtMs
    )
  `);
    return {
        getSecret(secretKey) {
            // normalizedSecretKey：统一清理空白，避免同一 key 因格式差异重复写入。
            const normalizedSecretKey = normalizeAuthSecretKey(secretKey);
            if (!normalizedSecretKey)
                throw new Error("auth secret key is required");
            // secretRow：数据库内现存的 secret 记录。
            const secretRow = getSecretStatement.get(normalizedSecretKey);
            if (!secretRow)
                return null;
            return String(secretRow.secret_value ?? "");
        },
        getOrCreateSecret(secretKey) {
            // normalizedSecretKey：统一后的内部 secret key。
            const normalizedSecretKey = normalizeAuthSecretKey(secretKey);
            if (!normalizedSecretKey)
                throw new Error("auth secret key is required");
            return authDb.runInTransaction(() => {
                // existingSecret：事务内优先读取，避免并发初始化重复写入。
                const existingSecret = getSecretStatement.get(normalizedSecretKey);
                if (existingSecret)
                    return String(existingSecret.secret_value ?? "");
                // createdAtMs：首次生成 secret 时的统一时间戳。
                const createdAtMs = Date.now();
                // secretValue：新生成的高熵随机 secret。
                const secretValue = generateRandomSecretValue();
                insertSecretStatement.run({
                    secretKey: normalizedSecretKey,
                    secretValue,
                    createdAtMs,
                    updatedAtMs: createdAtMs,
                });
                return secretValue;
            });
        },
    };
}
//# sourceMappingURL=authSecretStore.js.map