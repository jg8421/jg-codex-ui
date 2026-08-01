import { type AuthDb } from "./sqlite/authDb";
import type { CreateUserInput, StoredUser } from "./userTypes";
export type UserStore = {
    createUser(input: CreateUserInput): Promise<StoredUser>;
    getUserByUsername(username: string): Promise<StoredUser | null>;
    setUserPassword(username: string, password: string): Promise<StoredUser>;
    renameUser(username: string, nextUsername: string): Promise<StoredUser>;
    deleteUser(username: string): Promise<void>;
    assignWorkspaces(username: string, workspaces: string[]): Promise<StoredUser>;
    listUsers(): Promise<StoredUser[]>;
};
type CreateUserStoreOptions = {
    filePath?: string;
    dbPath?: string;
    authDb?: AuthDb;
};
/**
 * 创建用户仓库（当前默认使用 SQLite）。
 */
export declare function createUserStore(opts: CreateUserStoreOptions): Promise<UserStore>;
export {};
