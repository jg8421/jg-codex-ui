import { type AuthDb } from "../auth/sqlite/authDb";
export type UserWorkspaceStore = {
    listUserWorkspaceDirs(username: string): Promise<string[]>;
    replaceUserWorkspaceDirs(username: string, workspaceDirs: string[]): Promise<string[]>;
    renameUserWorkspaceOwner(username: string, nextUsername: string): Promise<string[]>;
    deleteUserWorkspaceDirs(username: string): Promise<void>;
};
type CreateUserWorkspaceStoreOptions = {
    filePath?: string;
    dbPath?: string;
    authDb?: AuthDb;
};
export declare function createUserWorkspaceStore(opts: CreateUserWorkspaceStoreOptions): Promise<UserWorkspaceStore>;
export {};
