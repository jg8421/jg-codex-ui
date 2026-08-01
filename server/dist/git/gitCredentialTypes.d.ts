/**
 * Git 远端协议类型；当前仅支持 HTTPS 与 SSH。
 */
export type GitCredentialProtocol = "https" | "ssh";
/**
 * HTTPS PAT 机密内容。
 */
export type GitHttpsPatSecret = {
    type: "https_pat";
    username: string;
    token: string;
};
/**
 * SSH 私钥机密内容。
 */
export type GitSshKeySecret = {
    type: "ssh_key";
    username: string;
    privateKey: string;
    passphrase: string | null;
};
/**
 * Git 凭证机密联合类型。
 */
export type GitCredentialSecret = GitHttpsPatSecret | GitSshKeySecret;
/**
 * 返回给前端的脱敏凭证结构。
 */
export type PublicGitCredential = {
    id: string;
    label: string;
    host: string;
    protocol: GitCredentialProtocol;
    type: GitCredentialSecret["type"];
    credentialUsername: string;
    hasPassphrase: boolean;
    createdAtMs: number;
    updatedAtMs: number;
};
/**
 * 创建 Git 凭证时的输入。
 */
export type CreateGitCredentialInput = {
    username: string;
    label: string;
    host: string;
    protocol: GitCredentialProtocol;
    credential: GitCredentialSecret;
};
/**
 * 更新 Git 凭证时的输入。
 */
export type UpdateGitCredentialInput = CreateGitCredentialInput & {
    credentialId: string;
};
/**
 * 查询指定凭证机密时的输入。
 */
export type GitCredentialSecretLookup = {
    username: string;
    credentialId: string;
};
/**
 * 按远端协议和主机匹配凭证时的输入。
 */
export type GitCredentialRemoteLookup = {
    username: string;
    host: string;
    protocol: GitCredentialProtocol;
};
/**
 * 远端匹配命中后的结果。
 */
export type MatchedGitCredential = {
    metadata: PublicGitCredential;
    secret: GitCredentialSecret;
};
