import type { AuthDb } from "./authDb";
/**
 * 旧 JSON 导入执行参数。
 */
export type LegacyImportOptions = {
    authDb: AuthDb;
    usersFilePath: string;
    userWorkspacesFilePath: string;
};
/**
 * 旧 JSON 导入结果摘要。
 */
export type LegacyImportResult = {
    imported: boolean;
    importedUsers: number;
    importedAssignedWorkspaces: number;
    importedWorkspaceDirs: number;
};
/**
 * 当 DB 为空时导入旧 JSON 配置数据。
 */
export declare function maybeImportLegacyJsonSettings(options: LegacyImportOptions): Promise<LegacyImportResult>;
