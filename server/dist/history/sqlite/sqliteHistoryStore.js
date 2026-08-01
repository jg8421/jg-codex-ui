"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSqliteHistoryStore = createSqliteHistoryStore;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fileChangeExtractor_1 = require("../../chat/fileChangeExtractor");
const threadPreviewTitle_1 = require("../../threadList/threadPreviewTitle");
const schema_1 = require("./schema");
const windowsVerbatimPath_1 = require("../../workspace/windowsVerbatimPath");
/**
 * 统一归一化毫秒时间戳，避免出现负数和小数。
 */
function normalizeMs(rawMs, fallbackMs) {
    const parsedMs = Number(rawMs);
    if (!Number.isFinite(parsedMs))
        return fallbackMs;
    return Math.max(0, Math.floor(parsedMs));
}
/**
 * 归一化线程摘要写入参数，避免空字符串与非法时间戳进入 SQLite。
 */
function normalizeThreadSummaryInput(input) {
    const normalizedId = String(input.id ?? "").trim();
    if (!normalizedId)
        throw new Error("thread summary id is required");
    const normalizedCreatedAt = normalizeMs(input.createdAt, 0);
    const normalizedUpdatedAt = normalizeMs(input.updatedAt, normalizedCreatedAt);
    return {
        id: normalizedId,
        preview: String(input.preview ?? ""),
        createdAt: normalizedCreatedAt,
        updatedAt: normalizedUpdatedAt,
        cwd: String(input.cwd ?? ""),
        modelProvider: String(input.modelProvider ?? ""),
    };
}
/**
 * 统一归一化线程 id，避免空值进入删除/查询语句。
 */
function normalizeThreadId(threadId) {
    return String(threadId ?? "").trim();
}
/**
 * 与 HistoryQueryService.resolveMessageTimestamp 对齐的 SQLite 时间戳表达式。
 *
 * 重要：该表达式必须与 schema.ts 里创建索引的 CASE 表达式保持一致。
 */
const MESSAGE_TS_MS_SQL = `
  CASE
    WHEN finished_at_ms IS NOT NULL AND finished_at_ms > 0 THEN finished_at_ms
    WHEN started_at_ms > 0 THEN started_at_ms
    WHEN created_at_ms > 0 THEN created_at_ms
    WHEN updated_at_ms > 0 THEN updated_at_ms
    ELSE 0
  END
`;
/**
 * 将消息 SQL 行映射为领域对象。
 */
function mapMessageRow(row) {
    return {
        threadId: row.thread_id,
        messageId: row.message_id,
        role: row.role,
        messageType: row.message_type,
        status: row.status,
        finalText: row.final_text,
        diffTitle: row.diff_title,
        diffChangesJson: row.diff_changes_json,
        diffOutput: row.diff_output,
        startedAtMs: row.started_at_ms,
        finishedAtMs: row.finished_at_ms,
        createdAtMs: row.created_at_ms,
        updatedAtMs: row.updated_at_ms,
    };
}
/**
 * 将线程摘要 SQL 行映射为领域对象。
 */
function mapThreadSummaryRow(row) {
    return {
        id: row.id,
        preview: row.preview,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        cwd: row.cwd,
        modelProvider: row.model_provider,
    };
}
/**
 * 为旧 messages 表补齐本次重构新增字段，避免升级后直接报错。
 */
function ensureMessageTableColumns(db) {
    const rows = db.prepare("PRAGMA table_info(messages);").all();
    const existingColumns = new Set(rows.map((row) => String(row.name ?? "").trim()).filter(Boolean));
    const maybeAddColumn = (name, typeSql) => {
        if (existingColumns.has(name))
            return;
        try {
            db.exec(`ALTER TABLE messages ADD COLUMN ${name} ${typeSql};`);
        }
        catch {
            // 迁移阶段仅 best-effort：避免异常阻断启动。
        }
    };
    maybeAddColumn("diff_title", "TEXT NOT NULL DEFAULT ''");
    maybeAddColumn("diff_changes_json", "TEXT NOT NULL DEFAULT ''");
    maybeAddColumn("diff_output", "TEXT NOT NULL DEFAULT ''");
}
/**
 * 为旧 file_change_entries 表补齐行数统计字段，避免升级后查询失败。
 */
function ensureFileChangeEntriesTableColumns(db) {
    const rows = db.prepare("PRAGMA table_info(file_change_entries);").all();
    const existingColumns = new Set(rows.map((row) => String(row.name ?? "").trim()).filter(Boolean));
    const maybeAddColumn = (name, typeSql) => {
        if (existingColumns.has(name))
            return;
        try {
            db.exec(`ALTER TABLE file_change_entries ADD COLUMN ${name} ${typeSql};`);
        }
        catch {
            // 迁移阶段仅 best-effort：避免异常阻断启动。
        }
    };
    maybeAddColumn("added_lines", "INTEGER NOT NULL DEFAULT 0");
    maybeAddColumn("deleted_lines", "INTEGER NOT NULL DEFAULT 0");
}
/**
 * 创建 SQLite 历史存储实例。
 */
function createSqliteHistoryStore(options) {
    // 确保 DB 目录存在，避免首次启动时打开文件失败。
    const dbDirPath = node_path_1.default.dirname(node_path_1.default.resolve(options.dbPath));
    node_fs_1.default.mkdirSync(dbDirPath, { recursive: true });
    // 共享连接并复用 prepared statements，降低频繁写入开销。
    const db = new better_sqlite3_1.default(options.dbPath);
    (0, schema_1.applyHistorySchema)(db);
    ensureMessageTableColumns(db);
    ensureFileChangeEntriesTableColumns(db);
    const upsertMessageStatement = db.prepare(`
    INSERT INTO messages (
      thread_id,
      message_id,
      role,
      message_type,
      status,
      final_text,
      diff_title,
      diff_changes_json,
      diff_output,
      started_at_ms,
      finished_at_ms,
      created_at_ms,
      updated_at_ms
    ) VALUES (
      @threadId,
      @messageId,
      @role,
      @messageType,
      @status,
      @finalText,
      @diffTitle,
      @diffChangesJson,
      @diffOutputDelta,
      @startedAtMs,
      @finishedAtMs,
      @createdAtMs,
      @updatedAtMs
    )
    ON CONFLICT(thread_id, message_id) DO UPDATE SET
      role = excluded.role,
      message_type = excluded.message_type,
      status = excluded.status,
      final_text = CASE
        WHEN excluded.final_text <> '' THEN excluded.final_text
        ELSE messages.final_text
      END,
      diff_title = CASE
        WHEN excluded.diff_title <> '' THEN excluded.diff_title
        ELSE messages.diff_title
      END,
      diff_changes_json = CASE
        WHEN excluded.diff_changes_json <> '' THEN excluded.diff_changes_json
        ELSE messages.diff_changes_json
      END,
      diff_output = CASE
        WHEN excluded.diff_output <> '' THEN messages.diff_output || excluded.diff_output
        ELSE messages.diff_output
      END,
      started_at_ms = CASE
        WHEN excluded.started_at_ms > 0 THEN excluded.started_at_ms
        ELSE messages.started_at_ms
      END,
      finished_at_ms = COALESCE(excluded.finished_at_ms, messages.finished_at_ms),
      updated_at_ms = excluded.updated_at_ms
  `);
    const listMessagesByThreadStatement = db.prepare(`
    SELECT
      thread_id,
      message_id,
      role,
      message_type,
      status,
      final_text,
      diff_title,
      diff_changes_json,
      diff_output,
      started_at_ms,
      finished_at_ms,
      created_at_ms,
      updated_at_ms
    FROM messages
    WHERE thread_id = ?
    ORDER BY (${MESSAGE_TS_MS_SQL}) ASC, message_id ASC
  `);
    // getMessageByThreadAndMessageIdStatement：按主键直查单条消息，避免长线程详情查询扫描。
    const getMessageByThreadAndMessageIdStatement = db.prepare(`
    SELECT
      thread_id,
      message_id,
      role,
      message_type,
      status,
      final_text,
      diff_title,
      diff_changes_json,
      diff_output,
      started_at_ms,
      finished_at_ms,
      created_at_ms,
      updated_at_ms
    FROM messages
    WHERE thread_id = ?
      AND message_id = ?
    LIMIT 1
  `);
    const findUaBoundaryStartCursorStatement = db.prepare(`
    WITH boundary_desc AS (
      SELECT
        (${MESSAGE_TS_MS_SQL}) AS ts_ms,
        message_id
      FROM messages
      WHERE thread_id = @threadId
        AND role IN ('user', 'assistant')
        AND (@beforeTs IS NULL OR (${MESSAGE_TS_MS_SQL}) < @beforeTs)
      ORDER BY ts_ms DESC, message_id DESC
      LIMIT @limit
    )
    SELECT ts_ms, message_id
    FROM boundary_desc
    ORDER BY ts_ms ASC, message_id ASC
    LIMIT 1
  `);
    const findFirstUaBoundaryCursorStatement = db.prepare(`
    SELECT
      (${MESSAGE_TS_MS_SQL}) AS ts_ms,
      message_id
    FROM messages
    WHERE thread_id = @threadId
      AND role IN ('user', 'assistant')
      AND (@beforeTs IS NULL OR (${MESSAGE_TS_MS_SQL}) < @beforeTs)
    ORDER BY ts_ms ASC, message_id ASC
    LIMIT 1
  `);
    const listMessagesByThreadWindowStatement = db.prepare(`
    SELECT
      thread_id,
      message_id,
      role,
      message_type,
      status,
      final_text,
      diff_title,
      diff_changes_json,
      '' AS diff_output,
      started_at_ms,
      finished_at_ms,
      created_at_ms,
      updated_at_ms
    FROM messages
    WHERE thread_id = @threadId
      AND (@beforeTs IS NULL OR (${MESSAGE_TS_MS_SQL}) < @beforeTs)
      AND (
        @includePrefix = 1
        OR (${MESSAGE_TS_MS_SQL}) > @startTs
        OR ((${MESSAGE_TS_MS_SQL}) = @startTs AND message_id >= @startMessageId)
      )
    ORDER BY (${MESSAGE_TS_MS_SQL}) ASC, message_id ASC
  `);
    // listFileChangeEntriesByThreadStatement：按线程列出 file_change 索引条目，供 Query 层聚合使用。
    const listFileChangeEntriesByThreadStatement = db.prepare(`
    SELECT
      thread_id,
      message_id,
      ts_ms,
      path,
      kind,
      added_lines,
      deleted_lines
    FROM file_change_entries
    WHERE thread_id = ?
    ORDER BY ts_ms DESC, message_id DESC, path ASC
  `);
    // deleteFileChangeEntriesForMessageStatement：重建前先清理旧条目，避免残留。
    const deleteFileChangeEntriesForMessageStatement = db.prepare(`
    DELETE FROM file_change_entries
    WHERE thread_id = @threadId AND message_id = @messageId
  `);
    // getFileChangeIndexSourceStatement：从 messages 读取 file_change 的最新 diff_changes_json 与 ts_ms（与 SQL 表达式一致）。
    const getFileChangeIndexSourceStatement = db.prepare(`
    SELECT
      message_type,
      diff_changes_json,
      (${MESSAGE_TS_MS_SQL}) AS ts_ms
    FROM messages
    WHERE thread_id = ? AND message_id = ?
    LIMIT 1
  `);
    // upsertFileChangeEntryStatement：插入单条索引条目；主键为 (thread_id, message_id, path)。
    const upsertFileChangeEntryStatement = db.prepare(`
    INSERT INTO file_change_entries (
      thread_id,
      message_id,
      ts_ms,
      path,
      kind,
      added_lines,
      deleted_lines
    ) VALUES (
      @threadId,
      @messageId,
      @tsMs,
      @path,
      @kind,
      @addedLines,
      @deletedLines
    )
    ON CONFLICT(thread_id, message_id, path) DO UPDATE SET
      ts_ms = excluded.ts_ms,
      kind = excluded.kind,
      added_lines = excluded.added_lines,
      deleted_lines = excluded.deleted_lines
  `);
    // listThreadSummariesStatement：默认按最近更新时间倒序返回持久化会话列表。
    const listThreadSummariesStatement = db.prepare(`
    SELECT
      id,
      preview,
      created_at,
      updated_at,
      cwd,
      model_provider
    FROM threads
    ORDER BY updated_at DESC, created_at DESC, id ASC
  `);
    // listThreadSummariesPageStatementByKey：缓存分页查询 statement，避免滚动加载时重复 prepare。
    const listThreadSummariesPageStatementByKey = new Map();
    /**
     * 生成线程列表分页查询 statement（带缓存）：
     * - 支持可选 cwd 精确过滤
     * - 支持可选 cursor 翻页（取更旧数据）
     */
    const getListThreadSummariesPageStatement = (input) => {
        const key = `${input.withCwd ? 1 : 0}:${input.withCursor ? 1 : 0}`;
        const cached = listThreadSummariesPageStatementByKey.get(key);
        if (cached)
            return cached;
        const whereParts = [];
        if (input.withCwd) {
            // cwd 精确过滤：兼容 plain 与 Windows verbatim 形式。
            whereParts.push("(cwd = @cwd OR cwd = @cwdVerbatim)");
        }
        if (input.withCursor) {
            // 游标翻页：按排序键（updated_at DESC, created_at DESC, id ASC）取更旧数据。
            whereParts.push(`(updated_at < @cursorUpdatedAt
          OR (updated_at = @cursorUpdatedAt AND created_at < @cursorCreatedAt)
          OR (updated_at = @cursorUpdatedAt AND created_at = @cursorCreatedAt AND id > @cursorId)
        )`);
        }
        const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
        const statement = db.prepare(`
      SELECT
        id,
        preview,
        created_at,
        updated_at,
        cwd,
        model_provider
      FROM threads
      ${whereSql}
      ORDER BY updated_at DESC, created_at DESC, id ASC
      LIMIT @limitPlusOne
    `);
        listThreadSummariesPageStatementByKey.set(key, statement);
        return statement;
    };
    // getThreadSummaryByIdStatement：按线程 id 读取当前摘要，用于“占位标题升级”为可读标题。
    const getThreadSummaryByIdStatement = db.prepare(`
    SELECT
      id,
      preview,
      created_at,
      updated_at,
      cwd,
      model_provider
    FROM threads
    WHERE id = ?
    LIMIT 1
  `);
    // upsertThreadSummaryStatement：CLI 刷新时将线程摘要同步回 SQLite。
    const upsertThreadSummaryStatement = db.prepare(`
    INSERT INTO threads (
      id,
      preview,
      created_at,
      updated_at,
      cwd,
      model_provider
    ) VALUES (
      @id,
      @preview,
      @createdAt,
      @updatedAt,
      @cwd,
      @modelProvider
    )
    ON CONFLICT(id) DO UPDATE SET
      preview = excluded.preview,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      cwd = excluded.cwd,
      model_provider = excluded.model_provider
  `);
    // deleteThreadSummaryByIdStatement：用于归档时同步删除 threads 行，避免 upsert 刷新后归档残留。
    const deleteThreadSummaryByIdStatement = db.prepare(`
    DELETE FROM threads
    WHERE id = ?
  `);
    // deleteFileChangeEntriesByThreadIdStatement：整线程删除时先清理 file_change 索引，避免残留详情入口。
    const deleteFileChangeEntriesByThreadIdStatement = db.prepare(`
    DELETE FROM file_change_entries
    WHERE thread_id = ?
  `);
    // deleteMessagesByThreadIdStatement：整线程删除时清理消息正文，保证历史接口不可再读取。
    const deleteMessagesByThreadIdStatement = db.prepare(`
    DELETE FROM messages
    WHERE thread_id = ?
  `);
    // clearThreadSummariesStatement：显式刷新线程列表时清空旧摘要，避免已归档线程残留在缓存中。
    const clearThreadSummariesStatement = db.prepare(`
    DELETE FROM threads
  `);
    // 事务包装器：让上层服务可以在一个原子事务中完成多表写入。
    const runInTransaction = db.transaction((callback) => callback());
    /**
     * 删除整条线程在本地 SQLite 的全部数据。
     */
    const deleteThreadHistoryRecords = (threadId) => {
        const normalizedThreadId = normalizeThreadId(threadId);
        if (!normalizedThreadId)
            return;
        runInTransaction(() => {
            deleteFileChangeEntriesByThreadIdStatement.run(normalizedThreadId);
            deleteMessagesByThreadIdStatement.run(normalizedThreadId);
            deleteThreadSummaryByIdStatement.run(normalizedThreadId);
        });
    };
    /**
     * 安全解析 file_change 的 changes JSON，抽取 path/kind 与行数统计。
     */
    const parseFileChangeIndexChanges = (rawJson) => {
        const normalizedJson = String(rawJson ?? "").trim();
        if (!normalizedJson)
            return [];
        try {
            const parsed = JSON.parse(normalizedJson);
            if (!Array.isArray(parsed))
                return [];
            const out = [];
            for (const rawChange of parsed) {
                const change = (rawChange ?? {});
                const changePath = String(change.path ?? "").trim();
                if (!changePath)
                    continue;
                const changeKind = String(change.kind ?? "change").trim() || "change";
                const diffText = typeof change.diff === "string"
                    ? change.diff
                    : typeof change.patch === "string"
                        ? change.patch
                        : typeof change.unifiedDiff === "string"
                            ? change.unifiedDiff
                            : "";
                // addedLines/deletedLines：优先使用已结构化值，缺失时从 diff 文本计算。
                const addedLinesFromField = Number(change.addedLines ?? change.added_lines);
                const deletedLinesFromField = Number(change.deletedLines ?? change.deleted_lines);
                const countedLineStats = (0, fileChangeExtractor_1.countUnifiedDiffLineStatsWithKind)(diffText, changeKind);
                const addedLines = Number.isFinite(addedLinesFromField)
                    ? Math.max(0, Math.floor(addedLinesFromField))
                    : countedLineStats.addedLines;
                const deletedLines = Number.isFinite(deletedLinesFromField)
                    ? Math.max(0, Math.floor(deletedLinesFromField))
                    : countedLineStats.deletedLines;
                out.push({ path: changePath, kind: changeKind, addedLines, deletedLines });
            }
            return out;
        }
        catch {
            return [];
        }
    };
    /**
     * 重建某条消息对应的 file_change_entries 索引条目。
     *
     * 说明：
     * - 先清理旧条目，再按 messages 中的最新 diff_changes_json 重新插入；
     * - 依赖 SQL 的 ts_ms 表达式，保证与消息排序语义一致。
     */
    const rebuildFileChangeEntriesForMessage = (input) => {
        deleteFileChangeEntriesForMessageStatement.run({ threadId: input.threadId, messageId: input.messageId });
        const sourceRow = getFileChangeIndexSourceStatement.get(input.threadId, input.messageId);
        if (!sourceRow)
            return;
        if (String(sourceRow.message_type ?? "") !== "file_change")
            return;
        const tsMs = Math.max(0, Math.floor(Number(sourceRow.ts_ms)));
        const changes = parseFileChangeIndexChanges(String(sourceRow.diff_changes_json ?? ""));
        for (const change of changes) {
            upsertFileChangeEntryStatement.run({
                threadId: input.threadId,
                messageId: input.messageId,
                tsMs,
                path: change.path,
                kind: change.kind,
                addedLines: change.addedLines,
                deletedLines: change.deletedLines,
            });
        }
    };
    /**
     * 当线程摘要标题仍是占位值时，尝试用用户消息首句回写为可读标题。
     */
    const promoteThreadPreviewFromUserMessage = (input) => {
        const normalizedThreadId = String(input.threadId ?? "").trim();
        if (!normalizedThreadId)
            return;
        const derivedPreview = (0, threadPreviewTitle_1.deriveThreadPreviewFromUserMessageText)(input.finalText);
        if (!derivedPreview)
            return;
        const existingThreadSummaryRow = getThreadSummaryByIdStatement.get(normalizedThreadId);
        if (!existingThreadSummaryRow) {
            upsertThreadSummaryStatement.run({
                id: normalizedThreadId,
                preview: derivedPreview,
                createdAt: input.createdAtMs,
                updatedAt: input.updatedAtMs,
                cwd: "",
                modelProvider: "",
            });
            return;
        }
        const existingThreadSummary = mapThreadSummaryRow(existingThreadSummaryRow);
        if (!(0, threadPreviewTitle_1.isPlaceholderThreadPreview)({ threadId: normalizedThreadId, preview: existingThreadSummary.preview }))
            return;
        upsertThreadSummaryStatement.run({
            ...existingThreadSummary,
            preview: derivedPreview,
            updatedAt: Math.max(existingThreadSummary.updatedAt, input.updatedAtMs),
        });
    };
    return {
        /**
         * 列出持久化线程摘要，按最近更新时间倒序返回。
         */
        listThreadSummaries() {
            const rows = listThreadSummariesStatement.all();
            return rows.map(mapThreadSummaryRow);
        },
        /**
         * 按游标分页列出线程摘要。
         */
        listThreadSummariesPage(input) {
            /**
             * 分页条数：避免调用方传入 0/负数/过大值导致扫描过多或 SQL 报错。
             */
            const parsedLimit = Number(input.limit ?? 0);
            const normalizedLimit = Number.isFinite(parsedLimit) ? Math.min(200, Math.max(1, Math.floor(parsedLimit))) : 30;
            /**
             * cwd 精确过滤：空串视为不过滤。
             */
            const normalizedCwd = typeof input.cwd === "string" ? input.cwd.trim() : "";
            const cwdFilter = normalizedCwd ? normalizedCwd : null;
            const cwdVerbatim = cwdFilter ? (0, windowsVerbatimPath_1.ensureWindowsVerbatimPathPrefix)(cwdFilter) : null;
            /**
             * cursor 参数：仅在三元组都有效时启用。
             */
            const cursor = input.cursor;
            const cursorId = String(cursor?.id ?? "").trim();
            const cursorUpdatedAt = Number(cursor?.updatedAt ?? 0);
            const cursorCreatedAt = Number(cursor?.createdAt ?? 0);
            const withCursor = Boolean(cursorId) && Number.isFinite(cursorUpdatedAt) && Number.isFinite(cursorCreatedAt) && cursorUpdatedAt >= 0 && cursorCreatedAt >= 0;
            const statement = getListThreadSummariesPageStatement({ withCwd: Boolean(cwdFilter), withCursor });
            /**
             * SQL 入参：只传 statement 需要的字段，避免不同版本 driver 对“多余参数”处理差异。
             */
            const params = { limitPlusOne: normalizedLimit + 1 };
            if (cwdFilter) {
                params.cwd = cwdFilter;
                params.cwdVerbatim = cwdVerbatim ?? cwdFilter;
            }
            if (withCursor) {
                params.cursorId = cursorId;
                params.cursorUpdatedAt = Math.max(0, Math.floor(cursorUpdatedAt));
                params.cursorCreatedAt = Math.max(0, Math.floor(cursorCreatedAt));
            }
            const rows = statement.all(params);
            const hasMore = rows.length > normalizedLimit;
            const pageRows = hasMore ? rows.slice(0, normalizedLimit) : rows;
            const threads = pageRows.map(mapThreadSummaryRow);
            const lastRow = pageRows.length > 0 ? pageRows[pageRows.length - 1] : null;
            const nextCursor = hasMore && lastRow
                ? {
                    updatedAt: Number(lastRow.updated_at ?? 0),
                    createdAt: Number(lastRow.created_at ?? 0),
                    id: String(lastRow.id ?? ""),
                }
                : null;
            return { threads, nextCursor };
        },
        /**
         * 按线程 id 列出线程摘要；结果按输入顺序返回（缺失项被忽略）。
         */
        getThreadSummariesByIds(threadIds) {
            /**
             * ids：去重且保序，避免 IN 语句过长且保持返回顺序稳定。
             */
            const seen = new Set();
            const ids = [];
            for (const rawThreadId of threadIds ?? []) {
                const normalizedThreadId = String(rawThreadId ?? "").trim();
                if (!normalizedThreadId)
                    continue;
                if (seen.has(normalizedThreadId))
                    continue;
                seen.add(normalizedThreadId);
                ids.push(normalizedThreadId);
            }
            if (!ids.length)
                return [];
            /**
             * 动态 IN 占位符：better-sqlite3 不支持直接绑定数组。
             */
            const placeholders = ids.map(() => "?").join(", ");
            const statement = db.prepare(`
        SELECT
          id,
          preview,
          created_at,
          updated_at,
          cwd,
          model_provider
        FROM threads
        WHERE id IN (${placeholders})
      `);
            const rows = statement.all(...ids);
            const summaryById = new Map(rows.map((row) => [row.id, mapThreadSummaryRow(row)]));
            const out = [];
            for (const id of ids) {
                const summary = summaryById.get(id);
                if (summary)
                    out.push(summary);
            }
            return out;
        },
        /**
         * 删除整条线程的本地历史数据；用于“本地立即消失且不再可读”的场景。
         */
        deleteThreadHistory(threadId) {
            deleteThreadHistoryRecords(threadId);
        },
        /**
         * 删除单条线程摘要；用于归档等“确定不应继续展示”的场景。
         */
        deleteThreadSummary(threadId) {
            const normalizedThreadId = normalizeThreadId(threadId);
            if (!normalizedThreadId)
                return;
            deleteThreadSummaryByIdStatement.run(normalizedThreadId);
        },
        /**
         * 插入或更新单条线程摘要。
         */
        upsertThreadSummary(input) {
            const normalizedThreadSummary = normalizeThreadSummaryInput(input);
            upsertThreadSummaryStatement.run(normalizedThreadSummary);
        },
        /**
         * 批量插入或更新线程摘要。
         */
        upsertThreadSummaries(inputs) {
            runInTransaction(() => {
                const persistedThreadSummaryRows = listThreadSummariesStatement.all();
                const persistedThreadSummaryById = new Map(persistedThreadSummaryRows.map((threadSummaryRow) => {
                    const persistedThreadSummary = mapThreadSummaryRow(threadSummaryRow);
                    return [persistedThreadSummary.id, persistedThreadSummary];
                }));
                for (const input of inputs) {
                    const normalizedThreadSummary = normalizeThreadSummaryInput(input);
                    const persistedThreadSummary = persistedThreadSummaryById.get(normalizedThreadSummary.id);
                    const nextPreview = persistedThreadSummary
                        ? (0, threadPreviewTitle_1.pickPreferredThreadPreview)({
                            threadId: normalizedThreadSummary.id,
                            persistedPreview: persistedThreadSummary.preview,
                            incomingPreview: normalizedThreadSummary.preview,
                        })
                        : normalizedThreadSummary.preview;
                    upsertThreadSummaryStatement.run({
                        ...normalizedThreadSummary,
                        preview: nextPreview,
                    });
                }
            });
        },
        /**
         * 使用最新 CLI 结果完整替换线程摘要缓存。
         */
        replaceThreadSummaries(inputs) {
            runInTransaction(() => {
                const persistedThreadSummaryRows = listThreadSummariesStatement.all();
                const persistedThreadSummaryById = new Map(persistedThreadSummaryRows.map((threadSummaryRow) => {
                    const persistedThreadSummary = mapThreadSummaryRow(threadSummaryRow);
                    return [persistedThreadSummary.id, persistedThreadSummary];
                }));
                clearThreadSummariesStatement.run();
                for (const input of inputs) {
                    const normalizedThreadSummary = normalizeThreadSummaryInput(input);
                    const persistedThreadSummary = persistedThreadSummaryById.get(normalizedThreadSummary.id);
                    const nextPreview = persistedThreadSummary
                        ? (0, threadPreviewTitle_1.pickPreferredThreadPreview)({
                            threadId: normalizedThreadSummary.id,
                            persistedPreview: persistedThreadSummary.preview,
                            incomingPreview: normalizedThreadSummary.preview,
                        })
                        : normalizedThreadSummary.preview;
                    upsertThreadSummaryStatement.run({
                        ...normalizedThreadSummary,
                        preview: nextPreview,
                    });
                }
            });
        },
        /**
         * 插入或更新结构化消息。
         */
        upsertMessage(input) {
            // 统一更新时间，便于后续按时间窗口清理与查询。
            const nowMs = Date.now();
            const updatedAtMs = normalizeMs(input.updatedAtMs, nowMs);
            const startedAtMs = normalizeMs(input.startedAtMs, 0);
            const createdAtMs = normalizeMs(input.createdAtMs, startedAtMs || updatedAtMs);
            const finishedAtMs = input.finishedAtMs === null || input.finishedAtMs === undefined
                ? null
                : normalizeMs(input.finishedAtMs, updatedAtMs);
            // shouldRebuildFileChangeIndex：仅在本次 upsert 可能影响 file_change 索引时触发重建。
            const shouldRebuildFileChangeIndex = input.messageType === "file_change" || typeof input.diffChangesJson === "string";
            runInTransaction(() => {
                upsertMessageStatement.run({
                    threadId: input.threadId,
                    messageId: input.messageId,
                    role: String(input.role ?? "assistant"),
                    messageType: String(input.messageType ?? "assistant_text"),
                    status: String(input.status ?? "streaming"),
                    finalText: String(input.finalText ?? ""),
                    diffTitle: String(input.diffTitle ?? ""),
                    diffChangesJson: String(input.diffChangesJson ?? ""),
                    diffOutputDelta: String(input.diffOutputDelta ?? ""),
                    startedAtMs,
                    finishedAtMs,
                    createdAtMs,
                    updatedAtMs,
                });
                if (shouldRebuildFileChangeIndex) {
                    rebuildFileChangeEntriesForMessage({ threadId: input.threadId, messageId: input.messageId });
                }
                const normalizedRole = String(input.role ?? "assistant");
                const normalizedMessageType = String(input.messageType ?? "assistant_text");
                if (normalizedRole === "user" && normalizedMessageType === "user_message") {
                    promoteThreadPreviewFromUserMessage({
                        threadId: input.threadId,
                        finalText: String(input.finalText ?? ""),
                        createdAtMs,
                        updatedAtMs,
                    });
                }
            });
        },
        /**
         * 列出线程内结构化消息，按消息时间戳升序返回。
         */
        listMessagesByThread(threadId) {
            const rows = listMessagesByThreadStatement.all(threadId);
            return rows.map(mapMessageRow);
        },
        /**
         * 列出线程内 file_change 索引条目，按消息时间戳倒序返回（最新在前）。
         */
        listFileChangeEntriesByThread(threadId) {
            const normalizedThreadId = normalizeThreadId(threadId);
            if (!normalizedThreadId)
                return [];
            const rows = listFileChangeEntriesByThreadStatement.all(normalizedThreadId);
            return rows.map((row) => ({
                threadId: row.thread_id,
                messageId: row.message_id,
                tsMs: row.ts_ms,
                path: row.path,
                kind: row.kind,
                addedLines: Number.isFinite(row.added_lines) ? Math.max(0, Math.floor(Number(row.added_lines))) : 0,
                deletedLines: Number.isFinite(row.deleted_lines) ? Math.max(0, Math.floor(Number(row.deleted_lines))) : 0,
            }));
        },
        /**
         * 按主键获取线程内单条结构化消息。
         */
        getMessageByThreadAndMessageId(threadId, messageId) {
            // normalizedThreadId/normalizedMessageId：避免空字符串误用造成意外扫描。
            const normalizedThreadId = normalizeThreadId(threadId);
            const normalizedMessageId = String(messageId ?? "").trim();
            if (!normalizedThreadId || !normalizedMessageId)
                return null;
            const row = getMessageByThreadAndMessageIdStatement.get(normalizedThreadId, normalizedMessageId);
            if (!row)
                return null;
            return mapMessageRow(row);
        },
        /**
         * 按 user/assistant 边界数量分页获取“消息窗口”，窗口内包含夹心的非边界消息。
         */
        listMessagesByThreadUaBoundaryPage(input) {
            // normalizedThreadId：避免空字符串导致的全表扫描与误用。
            const normalizedThreadId = normalizeThreadId(input.threadId);
            if (!normalizedThreadId)
                return [];
            // normalizedLimit：收敛为非负整数，避免出现 NaN/小数导致的意外行为。
            const normalizedLimit = Math.max(0, Math.floor(Number(input.limit)));
            if (normalizedLimit <= 0)
                return [];
            // beforeTs：用于“向前翻页”的上界（语义与 HistoryQueryService 的 `item.ts < beforeTs` 保持一致）。
            const beforeTs = input.beforeTs === null ? null : Math.max(0, Math.floor(Number(input.beforeTs)));
            const startCursor = findUaBoundaryStartCursorStatement.get({
                threadId: normalizedThreadId,
                limit: normalizedLimit,
                beforeTs,
            });
            // 没有边界：退化为返回该线程 beforeTs 之前的全部消息（自然包含前导非边界）。
            if (!startCursor) {
                const rows = listMessagesByThreadWindowStatement.all({
                    threadId: normalizedThreadId,
                    includePrefix: 1,
                    startTs: 0,
                    startMessageId: "",
                    beforeTs,
                });
                return rows.map(mapMessageRow);
            }
            const firstCursor = findFirstUaBoundaryCursorStatement.get({
                threadId: normalizedThreadId,
                beforeTs,
            });
            // includePrefix：窗口起点落在第一条边界时，需要把其之前的前导非边界消息一并返回（方案 A）。
            const includePrefix = Boolean(firstCursor &&
                Number(firstCursor.ts_ms) === Number(startCursor.ts_ms) &&
                String(firstCursor.message_id) === String(startCursor.message_id));
            const rows = listMessagesByThreadWindowStatement.all({
                threadId: normalizedThreadId,
                includePrefix: includePrefix ? 1 : 0,
                startTs: startCursor.ts_ms,
                startMessageId: startCursor.message_id,
                beforeTs,
            });
            return rows.map(mapMessageRow);
        },
        /**
         * 执行增量 vacuum，控制 SQLite 文件增长。
         */
        incrementalVacuum() {
            db.exec("PRAGMA incremental_vacuum;");
            db.exec("PRAGMA optimize;");
        },
        /**
         * 在单连接事务中执行回调，保证多写入原子性。
         */
        withTransaction(callback) {
            return runInTransaction(callback);
        },
        /**
         * 关闭 DB 连接，释放文件句柄。
         */
        close() {
            db.close();
        },
    };
}
//# sourceMappingURL=sqliteHistoryStore.js.map