"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSqliteWorkspaceStatusStore = createSqliteWorkspaceStatusStore;
/**
 * 规范化用户名输入。
 */
function normalizeUsername(username) {
    return String(username ?? "").trim();
}
/**
 * 去重并规范化用户名列表。
 */
function normalizeUsernames(usernames) {
    const seen = new Set();
    const normalized = [];
    for (const rawUsername of usernames ?? []) {
        const username = normalizeUsername(rawUsername);
        if (!username)
            continue;
        if (seen.has(username))
            continue;
        seen.add(username);
        normalized.push(username);
    }
    return normalized;
}
/**
 * 规范化线程 id。
 */
function normalizeThreadId(threadId) {
    return String(threadId ?? "").trim();
}
/**
 * 规范化 cwd。
 */
function normalizeCwd(cwd) {
    return String(cwd ?? "").trim();
}
/**
 * 规范化更新时间戳（ms）。
 */
function normalizeUpdatedAtMs(updatedAtMs) {
    const numericUpdatedAtMs = Number(updatedAtMs);
    if (Number.isFinite(numericUpdatedAtMs) && numericUpdatedAtMs > 0)
        return Math.floor(numericUpdatedAtMs);
    return Date.now();
}
/**
 * 基于 SQLite 创建工作目录状态仓库。
 */
function createSqliteWorkspaceStatusStore(options) {
    const db = options.authDb.db;
    const runInTransaction = options.authDb.runInTransaction;
    const selectThreadStatusStatement = db.prepare(`
    SELECT cwd, is_running, is_pending, has_completed_unread
    FROM auth_user_thread_status
    WHERE username = ? AND thread_id = ?
    LIMIT 1
  `);
    const upsertThreadStatusStatement = db.prepare(`
    INSERT INTO auth_user_thread_status (
      username, thread_id, cwd, is_running, is_pending, has_completed_unread, updated_at_ms
    ) VALUES (
      @username, @threadId, @cwd, @isRunning, @isPending, @hasCompletedUnread, @updatedAtMs
    )
    ON CONFLICT(username, thread_id) DO UPDATE SET
      cwd = excluded.cwd,
      is_running = excluded.is_running,
      is_pending = excluded.is_pending,
      has_completed_unread = excluded.has_completed_unread,
      updated_at_ms = excluded.updated_at_ms
  `);
    const deleteThreadStatusStatement = db.prepare(`
    DELETE FROM auth_user_thread_status
    WHERE username = ? AND thread_id = ?
  `);
    const deleteThreadStatusByUsernameStatement = db.prepare(`
    DELETE FROM auth_user_thread_status
    WHERE username = ?
  `);
    const listThreadStatusRowsByUsernameStatement = db.prepare(`
    SELECT thread_id, cwd, is_running AS has_running, is_pending AS has_pending, has_completed_unread, updated_at_ms
    FROM auth_user_thread_status
    WHERE username = ?
    ORDER BY updated_at_ms DESC, thread_id ASC
  `);
    /**
     * 清理某线程的 completedUnread（全局已读语义）：
     * - 任意用户打开线程后，清理所有用户维度的 `has_completed_unread`；
     * - 仅更新原本为 1 的行，避免无意义的 updated_at_ms 触碰导致排序抖动。
     */
    const clearCompletedUnreadByThreadIdStatement = db.prepare(`
    UPDATE auth_user_thread_status
    SET has_completed_unread = 0,
        updated_at_ms = @updatedAtMs
    WHERE thread_id = @threadId AND has_completed_unread != 0
  `);
    /**
     * 删除某线程的空状态行（running/pending/completed 都为 false）。
     */
    const deleteEmptyThreadStatusByThreadIdStatement = db.prepare(`
    DELETE FROM auth_user_thread_status
    WHERE thread_id = @threadId
      AND is_running = 0
      AND is_pending = 0
      AND has_completed_unread = 0
  `);
    const listWorkspaceStatusByUsernameStatement = db.prepare(`
    SELECT
      cwd,
      MAX(is_running) AS has_running,
      MAX(is_pending) AS has_pending,
      MAX(has_completed_unread) AS has_completed_unread,
      MAX(updated_at_ms) AS updated_at_ms
    FROM auth_user_thread_status
    WHERE username = ?
    GROUP BY cwd
    ORDER BY updated_at_ms DESC, cwd ASC
  `);
    /**
     * 读取某个用户线程状态；不存在时返回全 false。
     */
    const readThreadStatus = (username, threadId) => {
        const row = selectThreadStatusStatement.get(username, threadId);
        return {
            cwd: String(row?.cwd ?? ""),
            isRunning: Boolean(row?.is_running),
            isPending: Boolean(row?.is_pending),
            hasCompletedUnread: Boolean(row?.has_completed_unread),
        };
    };
    /**
     * 写回某个用户线程状态；若三类状态均为空则直接删除该行。
     */
    const writeThreadStatus = (username, threadId, cwd, status, updatedAtMs) => {
        if (!status.isRunning && !status.isPending && !status.hasCompletedUnread) {
            deleteThreadStatusStatement.run(username, threadId);
            return;
        }
        upsertThreadStatusStatement.run({
            username,
            threadId,
            cwd,
            isRunning: status.isRunning ? 1 : 0,
            isPending: status.isPending ? 1 : 0,
            hasCompletedUnread: status.hasCompletedUnread ? 1 : 0,
            updatedAtMs,
        });
    };
    return {
        async setThreadRunningForUsers(input) {
            const usernames = normalizeUsernames(input.usernames);
            const threadId = normalizeThreadId(input.threadId);
            const cwd = normalizeCwd(input.cwd);
            if (!usernames.length || !threadId || !cwd)
                return;
            const updatedAtMs = normalizeUpdatedAtMs(input.updatedAtMs);
            runInTransaction(() => {
                for (const username of usernames) {
                    const previousStatus = readThreadStatus(username, threadId);
                    writeThreadStatus(username, threadId, cwd, {
                        isRunning: input.isRunning,
                        isPending: previousStatus.isPending,
                        hasCompletedUnread: input.isRunning ? false : previousStatus.hasCompletedUnread,
                    }, updatedAtMs);
                }
            });
        },
        async setThreadPendingForUsers(input) {
            const usernames = normalizeUsernames(input.usernames);
            const threadId = normalizeThreadId(input.threadId);
            const cwd = normalizeCwd(input.cwd);
            if (!usernames.length || !threadId || !cwd)
                return;
            const updatedAtMs = normalizeUpdatedAtMs(input.updatedAtMs);
            runInTransaction(() => {
                for (const username of usernames) {
                    const previousStatus = readThreadStatus(username, threadId);
                    writeThreadStatus(username, threadId, cwd, {
                        isRunning: previousStatus.isRunning,
                        isPending: input.isPending,
                        hasCompletedUnread: previousStatus.hasCompletedUnread,
                    }, updatedAtMs);
                }
            });
        },
        async markThreadCompletedUnreadForUsers(input) {
            const usernames = normalizeUsernames(input.usernames);
            const threadId = normalizeThreadId(input.threadId);
            const cwd = normalizeCwd(input.cwd);
            if (!usernames.length || !threadId || !cwd)
                return;
            const updatedAtMs = normalizeUpdatedAtMs(input.updatedAtMs);
            runInTransaction(() => {
                for (const username of usernames) {
                    const previousStatus = readThreadStatus(username, threadId);
                    writeThreadStatus(username, threadId, cwd, {
                        isRunning: false,
                        isPending: previousStatus.isPending,
                        hasCompletedUnread: true,
                    }, updatedAtMs);
                }
            });
        },
        async markThreadSeen(usernameRaw, threadIdRaw, updatedAtMsRaw) {
            const threadId = normalizeThreadId(threadIdRaw);
            // usernameRaw：保留参数仅用于兼容旧调用点/表达“某用户触发已读”，实际清理为 thread 粒度。
            void normalizeUsername(usernameRaw);
            if (!threadId)
                return;
            const updatedAtMs = normalizeUpdatedAtMs(updatedAtMsRaw);
            runInTransaction(() => {
                clearCompletedUnreadByThreadIdStatement.run({
                    threadId,
                    updatedAtMs,
                });
                deleteEmptyThreadStatusByThreadIdStatement.run({ threadId });
            });
        },
        async renameUsername(usernameRaw, nextUsernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            const nextUsername = normalizeUsername(nextUsernameRaw);
            if (!nextUsername)
                throw new Error("next username is required");
            if (username === nextUsername)
                return;
            const rows = listThreadStatusRowsByUsernameStatement.all(username);
            runInTransaction(() => {
                deleteThreadStatusByUsernameStatement.run(nextUsername);
                for (const row of rows) {
                    const threadId = String(row.thread_id ?? "").trim();
                    const cwd = String(row.cwd ?? "");
                    if (!threadId || !cwd)
                        continue;
                    upsertThreadStatusStatement.run({
                        username: nextUsername,
                        threadId,
                        cwd,
                        isRunning: Number(row.has_running ?? 0) > 0 ? 1 : 0,
                        isPending: Number(row.has_pending ?? 0) > 0 ? 1 : 0,
                        hasCompletedUnread: Number(row.has_completed_unread ?? 0) > 0 ? 1 : 0,
                        updatedAtMs: Number(row.updated_at_ms ?? Date.now()),
                    });
                }
                deleteThreadStatusByUsernameStatement.run(username);
            });
        },
        async deleteUsername(usernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                throw new Error("username is required");
            deleteThreadStatusByUsernameStatement.run(username);
        },
        async listWorkspaceStatusByUsername(usernameRaw) {
            const username = normalizeUsername(usernameRaw);
            if (!username)
                return [];
            const rows = listWorkspaceStatusByUsernameStatement.all(username);
            return rows.map((row) => ({
                cwd: String(row.cwd ?? ""),
                hasRunning: Boolean(row.has_running),
                hasPending: Boolean(row.has_pending),
                hasCompletedUnread: Boolean(row.has_completed_unread),
                updatedAtMs: Number(row.updated_at_ms ?? 0),
            }));
        },
    };
}
//# sourceMappingURL=sqliteWorkspaceStatusStore.js.map