"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSqliteUserSettingsStore = createSqliteUserSettingsStore;
const userSettingsTypes_1 = require("./userSettingsTypes");
/**
 * 规范化用户名输入。
 */
function normalizeUsername(username) {
    return String(username ?? "").trim();
}
/**
 * 基于 SQLite 创建用户配置仓库。
 */
function createSqliteUserSettingsStore(options) {
    const db = options.authDb.db;
    const runInTransaction = options.authDb.runInTransaction;
    const getSettingsByUsernameStatement = db.prepare(`
    SELECT settings_json
    FROM auth_user_settings
    WHERE username = ?
    LIMIT 1
  `);
    const upsertSettingsStatement = db.prepare(`
    INSERT INTO auth_user_settings (
      username, settings_json, updated_at_ms
    ) VALUES (
      @username, @settingsJson, @updatedAtMs
    )
    ON CONFLICT(username) DO UPDATE SET
      settings_json = excluded.settings_json,
      updated_at_ms = excluded.updated_at_ms
  `);
    const deleteSettingsByUsernameStatement = db.prepare(`
    DELETE FROM auth_user_settings
    WHERE username = ?
  `);
    const renameSettingsOwnerStatement = db.prepare(`
    UPDATE auth_user_settings
    SET username = @nextUsername,
        updated_at_ms = @updatedAtMs
    WHERE username = @username
  `);
    return {
        async getUserSettings(usernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                return (0, userSettingsTypes_1.normalizeUserSettings)(null);
            const row = getSettingsByUsernameStatement.get(username);
            if (!row)
                return (0, userSettingsTypes_1.normalizeUserSettings)(null);
            try {
                const parsed = JSON.parse(String(row.settings_json ?? "{}"));
                return (0, userSettingsTypes_1.normalizeUserSettings)(parsed);
            }
            catch {
                return (0, userSettingsTypes_1.normalizeUserSettings)(null);
            }
        },
        async replaceUserSettings(usernameRaw, settingsRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            const normalizedSettings = (0, userSettingsTypes_1.normalizeUserSettings)(settingsRaw);
            upsertSettingsStatement.run({
                username,
                settingsJson: JSON.stringify(normalizedSettings),
                updatedAtMs: Date.now(),
            });
            return normalizedSettings;
        },
        async renameUserSettingsOwner(usernameRaw, nextUsernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            const nextUsername = normalizeUsername(nextUsernameRaw);
            if (!nextUsername)
                throw new Error("next username is required");
            if (username === nextUsername) {
                const currentRow = getSettingsByUsernameStatement.get(username);
                if (!currentRow)
                    return (0, userSettingsTypes_1.normalizeUserSettings)(null);
                try {
                    return (0, userSettingsTypes_1.normalizeUserSettings)(JSON.parse(String(currentRow.settings_json ?? "{}")));
                }
                catch {
                    return (0, userSettingsTypes_1.normalizeUserSettings)(null);
                }
            }
            runInTransaction(() => {
                deleteSettingsByUsernameStatement.run(nextUsername);
                renameSettingsOwnerStatement.run({
                    username,
                    nextUsername,
                    updatedAtMs: Date.now(),
                });
            });
            const renamedRow = getSettingsByUsernameStatement.get(nextUsername);
            if (!renamedRow)
                return (0, userSettingsTypes_1.normalizeUserSettings)(null);
            try {
                return (0, userSettingsTypes_1.normalizeUserSettings)(JSON.parse(String(renamedRow.settings_json ?? "{}")));
            }
            catch {
                return (0, userSettingsTypes_1.normalizeUserSettings)(null);
            }
        },
        async deleteUserSettings(usernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            deleteSettingsByUsernameStatement.run(username);
        },
    };
}
//# sourceMappingURL=sqliteUserSettingsStore.js.map