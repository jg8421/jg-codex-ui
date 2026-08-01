import express from "express";
import type { UserStore } from "../auth/userStore";
import type { AdminUserMaintenanceService } from "./adminUserMaintenanceService";
type CreateUserAdminRoutesOptions = {
    userStore: UserStore;
    adminUserMaintenanceService: AdminUserMaintenanceService;
};
export declare function createUserAdminRoutes(opts: CreateUserAdminRoutesOptions): express.Router;
export {};
