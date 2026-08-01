export type UserRole = "admin" | "member";
export type StoredUser = {
    username: string;
    role: UserRole;
    passwordHash: string;
    workspaces: string[];
};
export type CreateUserInput = {
    username: string;
    password: string;
    role: UserRole;
};
export type PublicUser = Omit<StoredUser, "passwordHash">;
