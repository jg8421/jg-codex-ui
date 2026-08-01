"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_USER_SETTINGS = void 0;
exports.normalizeUserSettings = normalizeUserSettings;
/**
 * 默认用户配置（每次读取时应复制，避免引用污染）。
 */
exports.DEFAULT_USER_SETTINGS = {
    locale: "zh-CN",
    theme: "light",
    accentColor: null,
    backgroundColor: null,
    sidebarCollapsed: true,
    cardCompactView: true,
    chatPresentation: "compact",
    browserNotificationSettings: {
        enabled: true,
        soundEnabled: true,
        scope: "hidden-only",
    },
    executionMode: "agent",
    approvalCwdCheckMode: "auth-workspaces",
    threadPinOverrides: {},
    threadNameOverrides: {},
    threadModelOverrides: {},
    webModelDefaults: {},
    gitCommitSummaryDefaults: {},
    customModels: [],
    quickSwitchModels: [],
    gitAuthPreferenceByRepo: {},
    threadPermissionsOverrides: {},
    threadCollaborationOverrides: {},
    defaultWorkspace: null,
};
/**
 * 判断输入是否为 plain object。
 */
function isRecord(input) {
    return typeof input === "object" && input !== null && !Array.isArray(input);
}
/**
 * 规范化字符串；空串回退为 null。
 */
function normalizeOptionalString(input) {
    const normalized = typeof input === "string" ? input.trim() : "";
    return normalized ? normalized : null;
}
/**
 * 规范化字符串；空串回退为 undefined。
 */
function normalizeOptionalStringAsUndefined(input) {
    const normalized = typeof input === "string" ? input.trim() : "";
    return normalized ? normalized : undefined;
}
/**
 * 规范化语言配置；非法值统一回退到 `zh-CN`。
 */
function normalizeLocale(input) {
    const normalized = String(input ?? "").trim();
    if (normalized === "en-US")
        return "en-US";
    return "zh-CN";
}
/**
 * 规范化会话展示风格；非法值统一回退到 `card`。
 */
function normalizeChatPresentation(input, record) {
    const normalized = String(input ?? "").trim();
    if (normalized === "compact")
        return "compact";
    if (normalized === "cli")
        return "cli";
    if (normalized === "card")
        return "card";
    const normalizedCardCompactView = normalizeCardCompactView(record, undefined);
    return normalizedCardCompactView ? "compact" : "card";
}
/**
 * 规范化“卡片紧凑模式”配置：
 * - 优先读取新字段 `cardCompactView`
 * - 兼容历史字段 `compactView`
 * - 缺失时默认开启（true）
 */
function normalizeCardCompactView(input, normalizedChatPresentation) {
    if (normalizedChatPresentation === "compact")
        return true;
    if (normalizedChatPresentation === "card" || normalizedChatPresentation === "cli")
        return false;
    const nextCardCompactView = input.cardCompactView;
    if (typeof nextCardCompactView === "boolean")
        return nextCardCompactView;
    const legacyCompactView = input.compactView;
    if (typeof legacyCompactView === "boolean")
        return legacyCompactView;
    return true;
}
/**
 * 去重并保序地规范化字符串数组。
 */
function normalizeStringArray(input) {
    if (!Array.isArray(input))
        return [];
    const seen = new Set();
    const normalized = [];
    for (const item of input) {
        const value = String(item ?? "").trim();
        if (!value)
            continue;
        if (seen.has(value))
            continue;
        seen.add(value);
        normalized.push(value);
    }
    return normalized;
}
/**
 * 规范化线程标题覆盖映射。
 */
function normalizeThreadNameOverrides(input) {
    if (!isRecord(input))
        return {};
    const out = {};
    for (const [threadId, rawTitle] of Object.entries(input)) {
        const normalizedThreadId = String(threadId ?? "").trim();
        if (!normalizedThreadId)
            continue;
        const title = String(rawTitle ?? "").trim();
        if (!title)
            continue;
        out[normalizedThreadId] = title;
    }
    return out;
}
/**
 * 规范化线程置顶映射：仅保留值为 `true` 的线程 id。
 */
function normalizeThreadPinOverrides(input) {
    if (!isRecord(input))
        return {};
    const normalizedThreadPinOverrides = {};
    for (const [threadId, rawPinned] of Object.entries(input)) {
        const normalizedThreadId = String(threadId ?? "").trim();
        if (!normalizedThreadId)
            continue;
        if (rawPinned !== true)
            continue;
        normalizedThreadPinOverrides[normalizedThreadId] = true;
    }
    return normalizedThreadPinOverrides;
}
/**
 * 规范化线程模型覆盖映射。
 */
function normalizeThreadModelOverrides(input) {
    if (!isRecord(input))
        return {};
    const out = {};
    for (const [threadId, rawOverride] of Object.entries(input)) {
        const normalizedThreadId = String(threadId ?? "").trim();
        if (!normalizedThreadId || !isRecord(rawOverride))
            continue;
        const model = normalizeOptionalStringAsUndefined(rawOverride.model);
        const reasoningEffort = normalizeOptionalStringAsUndefined(rawOverride.reasoningEffort);
        const serviceTier = rawOverride.serviceTier === "fast" ? rawOverride.serviceTier : undefined;
        if (!model && !reasoningEffort && !serviceTier)
            continue;
        out[normalizedThreadId] = { model, reasoningEffort, serviceTier };
    }
    return out;
}
/**
 * 规范化 Web 默认模型配置。
 */
function normalizeWebModelDefaults(input) {
    if (!isRecord(input))
        return {};
    const model = normalizeOptionalStringAsUndefined(input.model);
    const reasoningEffort = normalizeOptionalStringAsUndefined(input.reasoningEffort);
    const serviceTier = input.serviceTier === "fast" ? input.serviceTier : undefined;
    if (!model && !reasoningEffort && !serviceTier)
        return {};
    return { model, reasoningEffort, serviceTier };
}
/**
 * 规范化 Git 总结默认模型配置。
 */
function normalizeGitCommitSummaryDefaults(input) {
    if (!isRecord(input))
        return {};
    const model = normalizeOptionalStringAsUndefined(input.model);
    const reasoningEffort = normalizeOptionalStringAsUndefined(input.reasoningEffort);
    if (!model && !reasoningEffort)
        return {};
    return { model, reasoningEffort };
}
/**
 * 规范化浏览器提醒偏好。
 */
function normalizeBrowserNotificationSettings(input) {
    const rawSettings = isRecord(input) ? input : {};
    const scope = rawSettings.scope === "always" ? "always" : "hidden-only";
    return {
        enabled: typeof rawSettings.enabled === "boolean" ? rawSettings.enabled : true,
        soundEnabled: typeof rawSettings.soundEnabled === "boolean" ? rawSettings.soundEnabled : true,
        scope,
    };
}
/**
 * 规范化执行模式。
 */
function normalizeExecutionMode(input) {
    return String(input ?? "").trim() === "chat" ? "chat" : "agent";
}
/**
 * 规范化审批前 cwd 校验模式。
 */
function normalizeApprovalCwdCheckMode(input) {
    return String(input ?? "").trim() === "user-workspace-dirs" ? "user-workspace-dirs" : "auth-workspaces";
}
/**
 * 规范化单个 Git 认证偏好。
 */
function normalizeGitAuthPreference(input) {
    if (!isRecord(input))
        return null;
    const mode = input.mode === "local" || input.mode === "credential" ? input.mode : input.mode === "auto" ? "auto" : null;
    if (!mode)
        return null;
    const credentialId = normalizeOptionalStringAsUndefined(input.credentialId);
    if (mode === "credential") {
        if (!credentialId)
            return null;
        return { mode, credentialId };
    }
    return { mode };
}
/**
 * 规范化按仓库保存的 Git 认证偏好映射。
 */
function normalizeGitAuthPreferenceByRepo(input) {
    if (!isRecord(input))
        return {};
    const normalizedGitAuthPreferenceByRepo = {};
    for (const [repoKey, rawPreference] of Object.entries(input)) {
        const normalizedRepoKey = String(repoKey ?? "").trim();
        if (!normalizedRepoKey)
            continue;
        const normalizedPreference = normalizeGitAuthPreference(rawPreference);
        if (!normalizedPreference)
            continue;
        normalizedGitAuthPreferenceByRepo[normalizedRepoKey] = normalizedPreference;
    }
    return normalizedGitAuthPreferenceByRepo;
}
/**
 * 规范化线程权限覆盖映射。
 */
function normalizeThreadPermissionsOverrides(input) {
    if (!isRecord(input))
        return {};
    const out = {};
    for (const [threadId, rawOverride] of Object.entries(input)) {
        const normalizedThreadId = String(threadId ?? "").trim();
        if (!normalizedThreadId || !isRecord(rawOverride))
            continue;
        const approvalPolicyRaw = rawOverride.approvalPolicy;
        const approvalPolicy = approvalPolicyRaw === "untrusted" ||
            approvalPolicyRaw === "on-failure" ||
            approvalPolicyRaw === "on-request" ||
            approvalPolicyRaw === "never"
            ? approvalPolicyRaw
            : undefined;
        const sandboxRaw = rawOverride.sandbox;
        const sandbox = sandboxRaw === "read-only" || sandboxRaw === "workspace-write" || sandboxRaw === "danger-full-access" ? sandboxRaw : undefined;
        if (!approvalPolicy && !sandbox)
            continue;
        out[normalizedThreadId] = { approvalPolicy, sandbox };
    }
    return out;
}
/**
 * 规范化线程协作模式覆盖映射。
 */
function normalizeThreadCollaborationOverrides(input) {
    if (!isRecord(input))
        return {};
    const out = {};
    for (const [threadId, rawOverride] of Object.entries(input)) {
        const normalizedThreadId = String(threadId ?? "").trim();
        if (!normalizedThreadId || !isRecord(rawOverride))
            continue;
        const mode = rawOverride.mode === "plan" || rawOverride.mode === "default" ? rawOverride.mode : null;
        const rawSettings = isRecord(rawOverride.settings) ? rawOverride.settings : null;
        const model = normalizeOptionalString(rawSettings?.model);
        if (!mode || !model || !rawSettings)
            continue;
        const developerInstructions = typeof rawSettings.developer_instructions === "string" ? rawSettings.developer_instructions : null;
        const reasoningEffort = mode === "plan" ? null : typeof rawSettings.reasoning_effort === "string" ? rawSettings.reasoning_effort : null;
        out[normalizedThreadId] = {
            mode,
            settings: {
                model,
                developer_instructions: developerInstructions,
                reasoning_effort: reasoningEffort,
            },
        };
    }
    return out;
}
/**
 * 规范化用户配置输入，确保可安全入库与返回。
 */
function normalizeUserSettings(input) {
    const record = isRecord(input) ? input : {};
    const normalizedChatPresentation = normalizeChatPresentation(record.chatPresentation, record);
    return {
        locale: normalizeLocale(record.locale),
        theme: record.theme === "dark" ? "dark" : "light",
        accentColor: normalizeOptionalString(record.accentColor),
        backgroundColor: normalizeOptionalString(record.backgroundColor),
        sidebarCollapsed: typeof record.sidebarCollapsed === "boolean" ? record.sidebarCollapsed : true,
        cardCompactView: normalizeCardCompactView(record, normalizedChatPresentation),
        chatPresentation: normalizedChatPresentation,
        browserNotificationSettings: normalizeBrowserNotificationSettings(record.browserNotificationSettings),
        executionMode: normalizeExecutionMode(record.executionMode),
        approvalCwdCheckMode: normalizeApprovalCwdCheckMode(record.approvalCwdCheckMode),
        threadPinOverrides: normalizeThreadPinOverrides(record.threadPinOverrides),
        threadNameOverrides: normalizeThreadNameOverrides(record.threadNameOverrides),
        threadModelOverrides: normalizeThreadModelOverrides(record.threadModelOverrides),
        webModelDefaults: normalizeWebModelDefaults(record.webModelDefaults),
        gitCommitSummaryDefaults: normalizeGitCommitSummaryDefaults(record.gitCommitSummaryDefaults),
        customModels: normalizeStringArray(record.customModels),
        quickSwitchModels: normalizeStringArray(record.quickSwitchModels),
        gitAuthPreferenceByRepo: normalizeGitAuthPreferenceByRepo(record.gitAuthPreferenceByRepo),
        threadPermissionsOverrides: normalizeThreadPermissionsOverrides(record.threadPermissionsOverrides),
        threadCollaborationOverrides: normalizeThreadCollaborationOverrides(record.threadCollaborationOverrides),
        defaultWorkspace: normalizeOptionalString(record.defaultWorkspace),
    };
}
//# sourceMappingURL=userSettingsTypes.js.map