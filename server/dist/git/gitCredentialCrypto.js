"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptGitCredentialSecret = encryptGitCredentialSecret;
exports.decryptGitCredentialSecret = decryptGitCredentialSecret;
const node_crypto_1 = __importDefault(require("node:crypto"));
/**
 * 加密载荷版本号，便于后续平滑升级算法。
 */
const GIT_CREDENTIAL_CRYPTO_VERSION = 1;
/**
 * 规范化主密钥并派生为 32 字节 AES key。
 */
function deriveGitCredentialKey(masterKey) {
    const normalizedMasterKey = String(masterKey ?? "").trim();
    if (!normalizedMasterKey) {
        throw new Error("git credential master key is required");
    }
    return node_crypto_1.default.createHash("sha256").update(normalizedMasterKey, "utf8").digest();
}
/**
 * 使用 AES-256-GCM 加密任意 JSON 值。
 */
function encryptGitCredentialSecret(secret, masterKey) {
    const derivedKey = deriveGitCredentialKey(masterKey);
    const iv = node_crypto_1.default.randomBytes(12);
    const cipher = node_crypto_1.default.createCipheriv("aes-256-gcm", derivedKey, iv);
    const plaintext = JSON.stringify(secret);
    const encryptedPayload = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return JSON.stringify({
        v: GIT_CREDENTIAL_CRYPTO_VERSION,
        iv: iv.toString("base64"),
        tag: authTag.toString("base64"),
        data: encryptedPayload.toString("base64"),
    });
}
/**
 * 解密 Git 凭证密文并还原为 JSON。
 */
function decryptGitCredentialSecret(encryptedSecret, masterKey) {
    const derivedKey = deriveGitCredentialKey(masterKey);
    const payload = JSON.parse(String(encryptedSecret ?? ""));
    if (payload.v !== GIT_CREDENTIAL_CRYPTO_VERSION) {
        throw new Error("unsupported git credential cipher version");
    }
    const iv = Buffer.from(String(payload.iv ?? ""), "base64");
    const authTag = Buffer.from(String(payload.tag ?? ""), "base64");
    const encryptedPayload = Buffer.from(String(payload.data ?? ""), "base64");
    const decipher = node_crypto_1.default.createDecipheriv("aes-256-gcm", derivedKey, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(encryptedPayload), decipher.final()]).toString("utf8");
    return JSON.parse(plaintext);
}
//# sourceMappingURL=gitCredentialCrypto.js.map