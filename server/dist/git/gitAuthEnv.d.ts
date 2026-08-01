/**
 * askpass 脚本构造输出。
 */
export type GitAuthEnvBuildResult = {
    env: NodeJS.ProcessEnv;
    cleanupPaths: string[];
};
/**
 * 为 HTTPS 凭证构造单次 Git 命令所需环境变量。
 */
export declare function buildHttpsGitAuthEnv(tmpDirPath: string, secret: {
    username: string;
    token: string;
}): Promise<GitAuthEnvBuildResult>;
/**
 * 为 SSH 私钥凭证构造单次 Git 命令所需环境变量。
 */
export declare function buildSshGitAuthEnv(tmpDirPath: string, secret: {
    privateKey: string;
    passphrase: string | null;
}): Promise<GitAuthEnvBuildResult>;
