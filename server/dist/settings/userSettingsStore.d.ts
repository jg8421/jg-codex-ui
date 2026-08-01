import { type AuthDb } from "../auth/sqlite/authDb";
import type { UserSettings } from "./userSettingsTypes";
/**
 * 用户配置仓库接口（支持跨端同步）。
 */
export type UserSettingsStore = {
    getUserSettings(username: string): Promise<UserSettings>;
    replaceUserSettings(username: string, settings: UserSettings): Promise<UserSettings>;
    renameUserSettingsOwner(username: string, nextUsername: string): Promise<UserSettings>;
    deleteUserSettings(username: string): Promise<void>;
};
type CreateUserSettingsStoreOptions = {
    filePath?: string;
    dbPath?: string;
    authDb?: AuthDb;
};
/**
 * 创建用户配置仓库（当前默认使用 SQLite）。
 */
export declare function createUserSettingsStore(opts: CreateUserSettingsStoreOptions): Promise<UserSettingsStore>;
export {};
