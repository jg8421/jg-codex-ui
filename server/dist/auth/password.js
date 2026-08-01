"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const node_crypto_1 = __importDefault(require("node:crypto"));
// scrypt 参数：兼顾安全性与本项目的轻量级部署场景。
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
// 盐与导出密钥长度：盐用于防止彩虹表；导出密钥作为最终校验依据。
const SALT_BYTES = 16;
const KEY_BYTES = 32;
// 哈希格式版本号，方便未来升级哈希算法时保持兼容。
const FORMAT_VERSION = "scrypt";
function scryptAsync(password, salt, opts, keylen) {
    return new Promise((resolve, reject) => {
        node_crypto_1.default.scrypt(password, salt, keylen, opts, (err, derivedKey) => {
            if (err)
                reject(err);
            else
                resolve(derivedKey);
        });
    });
}
// 将明文密码哈希成可持久化的字符串（包含盐与必要参数）。
async function hashPassword(password) {
    const salt = node_crypto_1.default.randomBytes(SALT_BYTES);
    const derivedKey = await scryptAsync(password, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, KEY_BYTES);
    return [
        FORMAT_VERSION,
        String(SCRYPT_N),
        String(SCRYPT_R),
        String(SCRYPT_P),
        salt.toString("base64url"),
        derivedKey.toString("base64url"),
    ].join("$");
}
// 校验明文密码与已存储 hash 是否匹配；任何解析失败都返回 false（避免抛出导致 500）。
async function verifyPassword(password, storedHash) {
    const parts = String(storedHash ?? "").split("$");
    if (parts.length !== 6)
        return false;
    const [ver, rawN, rawR, rawP, saltB64, keyB64] = parts;
    if (ver !== FORMAT_VERSION)
        return false;
    const N = Number(rawN);
    const r = Number(rawR);
    const p = Number(rawP);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p))
        return false;
    let salt;
    let expected;
    try {
        salt = Buffer.from(saltB64, "base64url");
        expected = Buffer.from(keyB64, "base64url");
    }
    catch {
        return false;
    }
    if (!salt.length || expected.length !== KEY_BYTES)
        return false;
    const derivedKey = await scryptAsync(password, salt, { N, r, p }, KEY_BYTES);
    return node_crypto_1.default.timingSafeEqual(derivedKey, expected);
}
//# sourceMappingURL=password.js.map