"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSqliteGitCredentialStore = createSqliteGitCredentialStore;
const node_crypto_1 = __importDefault(require("node:crypto"));
const gitCredentialCrypto_1 = require("../gitCredentialCrypto");
const gitCredentialHost_1 = require("../gitCredentialHost");
/**
 * 规范化“凭证拥有者用户名”。
 */
function normalizeOwnerUsername(username) {
    return String(username ?? "").trim();
}
/**
 * 规范化展示名称。
 */
function normalizeCredentialLabel(label) {
    return String(label ?? "").trim();
}
/**
 * 规范化远端主机名；统一小写，方便稳定匹配。
 */
function normalizeCredentialHost(host) {
    return (0, gitCredentialHost_1.normalizeGitCredentialHost)(host);
}
/**
 * 规范化凭证 id。
 */
function normalizeCredentialId(credentialId) {
    return String(credentialId ?? "").trim();
}
/**
 * 将 SQLite 行映射为返回给前端的脱敏结构。
 */
function mapRowToPublicCredential(row) {
    return {
        id: row.id,
        label: row.label,
        host: row.host,
        protocol: row.protocol === "ssh" ? "ssh" : "https",
        type: row.credential_type === "ssh_key" ? "ssh_key" : "https_pat",
        credentialUsername: row.credential_username,
        hasPassphrase: Number(row.has_passphrase ?? 0) > 0,
        createdAtMs: Number(row.created_at_ms ?? 0),
        updatedAtMs: Number(row.updated_at_ms ?? 0),
    };
}
/**
 * 校验并规范化待写入的 Git 凭证。
 */
function normalizeCreateGitCredentialInput(input) {
    const ownerUsername = normalizeOwnerUsername(input.username);
    if (!ownerUsername)
        throw new Error("username is required");
    const label = normalizeCredentialLabel(input.label);
    if (!label)
        throw new Error("label is required");
    const host = normalizeCredentialHost(input.host);
    if (!host)
        throw new Error("host is required");
    const protocol = input.protocol === "ssh" ? "ssh" : "https";
    const credentialType = input.credential?.type;
    const credentialUsername = String(input.credential?.username ?? "").trim();
    if (!credentialUsername)
        throw new Error("credential username is required");
    if (credentialType === "https_pat") {
        const token = String(input.credential.token ?? "").trim();
        if (!token)
            throw new Error("token is required");
        return {
            username: ownerUsername,
            label,
            host,
            protocol: "https",
            credential: {
                type: "https_pat",
                username: credentialUsername,
                token,
            },
        };
    }
    if (credentialType === "ssh_key") {
        const privateKey = String(input.credential.privateKey ?? "").trim();
        if (!privateKey)
            throw new Error("privateKey is required");
        const passphrase = String(input.credential.passphrase ?? "").trim();
        return {
            username: ownerUsername,
            label,
            host,
            protocol: "ssh",
            credential: {
                type: "ssh_key",
                username: credentialUsername,
                privateKey: privateKey.endsWith("\n") ? privateKey : `${privateKey}\n`,
                passphrase: passphrase || null,
            },
        };
    }
    throw new Error("credential type is required");
}
/**
 * 基于 SQLite 创建 Git 凭证仓库。
 */
function createSqliteGitCredentialStore(options) {
    const db = options.authDb.db;
    const masterKey = String(options.masterKey ?? "");
    const runInTransaction = options.authDb.runInTransaction;
    const insertCredentialStatement = db.prepare(`
    INSERT INTO auth_user_git_credentials (
      id,
      owner_username,
      label,
      host,
      protocol,
      credential_type,
      credential_username,
      secret_encrypted,
      has_passphrase,
      created_at_ms,
      updated_at_ms
    ) VALUES (
      @id,
      @ownerUsername,
      @label,
      @host,
      @protocol,
      @credentialType,
      @credentialUsername,
      @secretEncrypted,
      @hasPassphrase,
      @createdAtMs,
      @updatedAtMs
    )
  `);
    const updateCredentialStatement = db.prepare(`
    UPDATE auth_user_git_credentials
    SET
      label = @label,
      host = @host,
      protocol = @protocol,
      credential_type = @credentialType,
      credential_username = @credentialUsername,
      secret_encrypted = @secretEncrypted,
      has_passphrase = @hasPassphrase,
      updated_at_ms = @updatedAtMs
    WHERE owner_username = @ownerUsername AND id = @credentialId
  `);
    const listCredentialsByOwnerStatement = db.prepare(`
    SELECT
      id,
      owner_username,
      label,
      host,
      protocol,
      credential_type,
      credential_username,
      secret_encrypted,
      has_passphrase,
      created_at_ms,
      updated_at_ms
    FROM auth_user_git_credentials
    WHERE owner_username = ?
    ORDER BY updated_at_ms DESC, id DESC
  `);
    const getCredentialSecretByIdStatement = db.prepare(`
    SELECT
      id,
      owner_username,
      label,
      host,
      protocol,
      credential_type,
      credential_username,
      secret_encrypted,
      has_passphrase,
      created_at_ms,
      updated_at_ms
    FROM auth_user_git_credentials
    WHERE owner_username = ? AND id = ?
    LIMIT 1
  `);
    const getCredentialByRemoteStatement = db.prepare(`
    SELECT
      id,
      owner_username,
      label,
      host,
      protocol,
      credential_type,
      credential_username,
      secret_encrypted,
      has_passphrase,
      created_at_ms,
      updated_at_ms
    FROM auth_user_git_credentials
    WHERE owner_username = ? AND host = ? AND protocol = ?
    ORDER BY updated_at_ms DESC, id DESC
    LIMIT 1
  `);
    const deleteCredentialByIdStatement = db.prepare(`
    DELETE FROM auth_user_git_credentials
    WHERE owner_username = ? AND id = ?
  `);
    const renameCredentialOwnerStatement = db.prepare(`
    UPDATE auth_user_git_credentials
    SET owner_username = @nextUsername,
        updated_at_ms = @updatedAtMs
    WHERE owner_username = @username
  `);
    const deleteCredentialsByOwnerStatement = db.prepare(`
    DELETE FROM auth_user_git_credentials
    WHERE owner_username = ?
  `);
    return {
        async listCredentials(username) {
            const ownerUsername = normalizeOwnerUsername(username);
            if (!ownerUsername)
                return [];
            const credentialRows = listCredentialsByOwnerStatement.all(ownerUsername);
            return credentialRows.map((credentialRow) => mapRowToPublicCredential(credentialRow));
        },
        async createCredential(input) {
            const normalizedInput = normalizeCreateGitCredentialInput(input);
            const nowMs = Date.now();
            const credentialId = node_crypto_1.default.randomUUID();
            const secretEncrypted = (0, gitCredentialCrypto_1.encryptGitCredentialSecret)(normalizedInput.credential, masterKey);
            insertCredentialStatement.run({
                id: credentialId,
                ownerUsername: normalizedInput.username,
                label: normalizedInput.label,
                host: normalizedInput.host,
                protocol: normalizedInput.protocol,
                credentialType: normalizedInput.credential.type,
                credentialUsername: normalizedInput.credential.username,
                secretEncrypted,
                hasPassphrase: normalizedInput.credential.type === "ssh_key" && normalizedInput.credential.passphrase ? 1 : 0,
                createdAtMs: nowMs,
                updatedAtMs: nowMs,
            });
            return {
                id: credentialId,
                label: normalizedInput.label,
                host: normalizedInput.host,
                protocol: normalizedInput.protocol,
                type: normalizedInput.credential.type,
                credentialUsername: normalizedInput.credential.username,
                hasPassphrase: normalizedInput.credential.type === "ssh_key" && Boolean(normalizedInput.credential.passphrase),
                createdAtMs: nowMs,
                updatedAtMs: nowMs,
            };
        },
        async updateCredential(input) {
            // normalizedCredentialId：待更新的目标凭证 id。
            const normalizedCredentialId = normalizeCredentialId(input.credentialId);
            if (!normalizedCredentialId)
                throw new Error("credentialId is required");
            // normalizedInput：更新后的标准化凭证内容；会强制要求重新填写敏感字段。
            const normalizedInput = normalizeCreateGitCredentialInput(input);
            // existingCredentialRow：用于保留原始 createdAtMs，并确认目标记录存在。
            const existingCredentialRow = getCredentialSecretByIdStatement.get(normalizedInput.username, normalizedCredentialId);
            if (!existingCredentialRow)
                return null;
            // nowMs：本次更新写入的更新时间。
            const nowMs = Date.now();
            // secretEncrypted：更新后重新加密的密文。
            const secretEncrypted = (0, gitCredentialCrypto_1.encryptGitCredentialSecret)(normalizedInput.credential, masterKey);
            updateCredentialStatement.run({
                credentialId: normalizedCredentialId,
                ownerUsername: normalizedInput.username,
                label: normalizedInput.label,
                host: normalizedInput.host,
                protocol: normalizedInput.protocol,
                credentialType: normalizedInput.credential.type,
                credentialUsername: normalizedInput.credential.username,
                secretEncrypted,
                hasPassphrase: normalizedInput.credential.type === "ssh_key" && normalizedInput.credential.passphrase ? 1 : 0,
                updatedAtMs: nowMs,
            });
            return {
                id: normalizedCredentialId,
                label: normalizedInput.label,
                host: normalizedInput.host,
                protocol: normalizedInput.protocol,
                type: normalizedInput.credential.type,
                credentialUsername: normalizedInput.credential.username,
                hasPassphrase: normalizedInput.credential.type === "ssh_key" && Boolean(normalizedInput.credential.passphrase),
                createdAtMs: Number(existingCredentialRow.created_at_ms ?? 0),
                updatedAtMs: nowMs,
            };
        },
        async deleteCredential(username, credentialId) {
            const ownerUsername = normalizeOwnerUsername(username);
            const normalizedCredentialId = normalizeCredentialId(credentialId);
            if (!ownerUsername || !normalizedCredentialId)
                return false;
            const result = deleteCredentialByIdStatement.run(ownerUsername, normalizedCredentialId);
            return Number(result.changes ?? 0) > 0;
        },
        async renameOwnerUsername(username, nextUsername) {
            const ownerUsername = normalizeOwnerUsername(username);
            if (!ownerUsername)
                throw new Error("username is required");
            const nextOwnerUsername = normalizeOwnerUsername(nextUsername);
            if (!nextOwnerUsername)
                throw new Error("next username is required");
            if (ownerUsername === nextOwnerUsername)
                return;
            runInTransaction(() => {
                renameCredentialOwnerStatement.run({
                    username: ownerUsername,
                    nextUsername: nextOwnerUsername,
                    updatedAtMs: Date.now(),
                });
            });
        },
        async deleteOwnerCredentials(username) {
            const ownerUsername = normalizeOwnerUsername(username);
            if (!ownerUsername)
                throw new Error("username is required");
            deleteCredentialsByOwnerStatement.run(ownerUsername);
        },
        async getCredentialSecret(input) {
            const ownerUsername = normalizeOwnerUsername(input.username);
            const normalizedCredentialId = normalizeCredentialId(input.credentialId);
            if (!ownerUsername || !normalizedCredentialId)
                return null;
            const credentialRow = getCredentialSecretByIdStatement.get(ownerUsername, normalizedCredentialId);
            if (!credentialRow)
                return null;
            return (0, gitCredentialCrypto_1.decryptGitCredentialSecret)(credentialRow.secret_encrypted, masterKey);
        },
        async getCredentialById(input) {
            const ownerUsername = normalizeOwnerUsername(input.username);
            const normalizedCredentialId = normalizeCredentialId(input.credentialId);
            if (!ownerUsername || !normalizedCredentialId)
                return null;
            const credentialRow = getCredentialSecretByIdStatement.get(ownerUsername, normalizedCredentialId);
            if (!credentialRow)
                return null;
            return {
                metadata: mapRowToPublicCredential(credentialRow),
                secret: (0, gitCredentialCrypto_1.decryptGitCredentialSecret)(credentialRow.secret_encrypted, masterKey),
            };
        },
        async findCredentialForRemote(input) {
            const ownerUsername = normalizeOwnerUsername(input.username);
            const host = normalizeCredentialHost(input.host);
            const protocol = input.protocol === "ssh" ? "ssh" : "https";
            if (!ownerUsername || !host)
                return null;
            const credentialRow = getCredentialByRemoteStatement.get(ownerUsername, host, protocol);
            if (!credentialRow)
                return null;
            return {
                metadata: mapRowToPublicCredential(credentialRow),
                secret: (0, gitCredentialCrypto_1.decryptGitCredentialSecret)(credentialRow.secret_encrypted, masterKey),
            };
        },
    };
}
//# sourceMappingURL=sqliteGitCredentialStore.js.map