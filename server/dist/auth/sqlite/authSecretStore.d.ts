import type { AuthDb } from "./authDb";
/**
 * 认证数据库内部 secret 仓库接口。
 */
export type AuthSecretStore = {
    getSecret(secretKey: string): string | null;
    getOrCreateSecret(secretKey: string): string;
};
/**
 * 基于认证数据库创建内部 secret 仓库。
 */
export declare function createAuthSecretStore(authDb: AuthDb): AuthSecretStore;
