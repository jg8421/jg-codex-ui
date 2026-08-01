import type { AuthDb } from "../../auth/sqlite/authDb";
import type { CreateGitCredentialInput, GitCredentialRemoteLookup, GitCredentialSecret, GitCredentialSecretLookup, MatchedGitCredential, PublicGitCredential, UpdateGitCredentialInput } from "../gitCredentialTypes";
/**
 * SQLite Git 凭证仓库创建参数。
 */
export type CreateSqliteGitCredentialStoreOptions = {
    authDb: AuthDb;
    masterKey: string;
};
/**
 * Git 凭证仓库对外接口。
 */
export type SqliteGitCredentialStore = {
    listCredentials(username: string): Promise<PublicGitCredential[]>;
    createCredential(input: CreateGitCredentialInput): Promise<PublicGitCredential>;
    updateCredential(input: UpdateGitCredentialInput): Promise<PublicGitCredential | null>;
    deleteCredential(username: string, credentialId: string): Promise<boolean>;
    renameOwnerUsername(username: string, nextUsername: string): Promise<void>;
    deleteOwnerCredentials(username: string): Promise<void>;
    getCredentialSecret(input: GitCredentialSecretLookup): Promise<GitCredentialSecret | null>;
    getCredentialById(input: GitCredentialSecretLookup): Promise<MatchedGitCredential | null>;
    findCredentialForRemote(input: GitCredentialRemoteLookup): Promise<MatchedGitCredential | null>;
};
/**
 * 基于 SQLite 创建 Git 凭证仓库。
 */
export declare function createSqliteGitCredentialStore(options: CreateSqliteGitCredentialStoreOptions): SqliteGitCredentialStore;
