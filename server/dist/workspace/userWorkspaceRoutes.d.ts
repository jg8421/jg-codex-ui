import express from "express";
import type { UserWorkspaceStore } from "./userWorkspaceStore";
type CreateUserWorkspaceRoutesOptions = {
    userWorkspaceStore: UserWorkspaceStore;
};
export declare function createUserWorkspaceRoutes(opts: CreateUserWorkspaceRoutesOptions): express.Router;
export {};
