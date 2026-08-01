/**
 * 计算某个用户的上传目录路径及其是否位于 Codex 工作目录内。
 */
export declare function getUserUploadsDir(username: string): {
    dir: string;
    withinCodexCwd: boolean;
};
/**
 * 将旧用户名的上传目录迁移到新用户名目录；旧目录不存在时视为无操作。
 */
export declare function renameUserUploadsDir(username: string, nextUsername: string): Promise<void>;
/**
 * 删除指定用户名对应的上传目录；目录不存在时视为无操作。
 */
export declare function deleteUserUploadsDir(username: string): Promise<void>;
