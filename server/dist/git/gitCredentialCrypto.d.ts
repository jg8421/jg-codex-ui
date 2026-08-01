/**
 * 使用 AES-256-GCM 加密任意 JSON 值。
 */
export declare function encryptGitCredentialSecret(secret: unknown, masterKey: string): string;
/**
 * 解密 Git 凭证密文并还原为 JSON。
 */
export declare function decryptGitCredentialSecret<T>(encryptedSecret: string, masterKey: string): T;
