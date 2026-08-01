/**
 * 用户可同步的审批策略。
 */
export type UserApprovalPolicy = "untrusted" | "on-failure" | "on-request" | "never";
/**
 * 用户可同步的语言配置。
 */
export type UserLocale = "zh-CN" | "en-US";
/**
 * 用户可同步的沙箱模式。
 */
export type UserSandboxMode = "read-only" | "workspace-write" | "danger-full-access";
/**
 * 线程级模型覆盖配置。
 */
export type UserServiceTier = "fast";
export type UserThreadModelOverride = {
    model?: string;
    reasoningEffort?: string;
    serviceTier?: UserServiceTier;
};
/**
 * Web 默认模型配置。
 */
export type UserWebModelDefaults = {
    model?: string;
    reasoningEffort?: string;
    serviceTier?: UserServiceTier;
};
/**
 * Git 提交总结默认模型配置。
 */
export type UserGitCommitSummaryDefaults = {
    model?: string;
    reasoningEffort?: string;
};
/**
 * 线程级权限覆盖配置。
 */
export type UserThreadPermissionsOverride = {
    approvalPolicy?: UserApprovalPolicy;
    sandbox?: UserSandboxMode;
};
/**
 * 线程级协作模式覆盖配置。
 */
export type UserThreadCollaborationOverride = {
    mode: "plan" | "default";
    settings: {
        model: string;
        developer_instructions?: string | null;
        reasoning_effort?: string | null;
    };
};
/**
 * 浏览器提醒触发范围。
 */
export type UserBrowserNotificationScope = "hidden-only" | "always";
/**
 * 浏览器提醒偏好。
 */
export type UserBrowserNotificationSettings = {
    enabled: boolean;
    soundEnabled: boolean;
    scope: UserBrowserNotificationScope;
};
/**
 * 执行模式。
 */
export type UserExecutionMode = "agent" | "chat";
/**
 * 审批前 cwd 校验模式。
 */
export type UserApprovalCwdCheckMode = "auth-workspaces" | "user-workspace-dirs";
/**
 * Git 认证偏好模式。
 */
export type UserGitAuthMode = "auto" | "local" | "credential";
/**
 * Git 认证偏好。
 */
export type UserGitAuthPreference = {
    mode: UserGitAuthMode;
    credentialId?: string;
};
/**
 * 用户配置持久化结构（用于跨端同步）。
 */
export type UserSettings = {
    locale: UserLocale;
    theme: "light" | "dark";
    accentColor: string | null;
    backgroundColor: string | null;
    sidebarCollapsed: boolean;
    cardCompactView: boolean;
    /**
     * 会话展示风格：
     * - `card`：现有卡片式消息展示（默认）
     * - `cli`：CLI transcript 列表风格（role> 前缀 + hover 操作）
     */
    chatPresentation: "card" | "compact" | "cli";
    browserNotificationSettings: UserBrowserNotificationSettings;
    executionMode: UserExecutionMode;
    approvalCwdCheckMode: UserApprovalCwdCheckMode;
    threadPinOverrides: Record<string, boolean>;
    threadNameOverrides: Record<string, string>;
    threadModelOverrides: Record<string, UserThreadModelOverride>;
    webModelDefaults: UserWebModelDefaults;
    gitCommitSummaryDefaults: UserGitCommitSummaryDefaults;
    customModels: string[];
    quickSwitchModels: string[];
    gitAuthPreferenceByRepo: Record<string, UserGitAuthPreference>;
    threadPermissionsOverrides: Record<string, UserThreadPermissionsOverride>;
    threadCollaborationOverrides: Record<string, UserThreadCollaborationOverride>;
    defaultWorkspace: string | null;
};
/**
 * 默认用户配置（每次读取时应复制，避免引用污染）。
 */
export declare const DEFAULT_USER_SETTINGS: UserSettings;
/**
 * 规范化用户配置输入，确保可安全入库与返回。
 */
export declare function normalizeUserSettings(input: unknown): UserSettings;
