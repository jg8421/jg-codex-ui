"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyHistorySchema = applyHistorySchema;
/**
 * 初始化历史数据库表结构与常用索引。
 */
function applyHistorySchema(db) {
    db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    PRAGMA auto_vacuum=INCREMENTAL;

    CREATE TABLE IF NOT EXISTS messages (
      thread_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      role TEXT NOT NULL,
      message_type TEXT NOT NULL,
      status TEXT NOT NULL,
      final_text TEXT NOT NULL DEFAULT "",
      diff_title TEXT NOT NULL DEFAULT "",
      diff_changes_json TEXT NOT NULL DEFAULT "",
      diff_output TEXT NOT NULL DEFAULT "",
      started_at_ms INTEGER NOT NULL DEFAULT 0,
      finished_at_ms INTEGER,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      PRIMARY KEY(thread_id, message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_thread_created
      ON messages(thread_id, created_at_ms);

    -- ts_ms：与 HistoryQueryService.resolveMessageTimestamp 的语义保持一致（优先 finished -> started -> created -> updated）。
    -- 注意：该表达式会同时用于索引与后续分页 SQL，必须保持完全一致。
    CREATE INDEX IF NOT EXISTS idx_messages_thread_ts_message
      ON messages(
        thread_id,
        (
          CASE
            WHEN finished_at_ms IS NOT NULL AND finished_at_ms > 0 THEN finished_at_ms
            WHEN started_at_ms > 0 THEN started_at_ms
            WHEN created_at_ms > 0 THEN created_at_ms
            WHEN updated_at_ms > 0 THEN updated_at_ms
            ELSE 0
          END
        ),
        message_id
      );

    -- 边界分页专用索引：仅覆盖 user/assistant（partial index）。
    CREATE INDEX IF NOT EXISTS idx_messages_thread_ts_message_boundary
      ON messages(
        thread_id,
        (
          CASE
            WHEN finished_at_ms IS NOT NULL AND finished_at_ms > 0 THEN finished_at_ms
            WHEN started_at_ms > 0 THEN started_at_ms
            WHEN created_at_ms > 0 THEN created_at_ms
            WHEN updated_at_ms > 0 THEN updated_at_ms
            ELSE 0
          END
        ),
        message_id
      )
      WHERE role IN ('user', 'assistant');

    -- file_change_entries：file_change 的“文件变更摘要索引表”，用于快速返回文件变更列表（无需扫描 messages）。
    CREATE TABLE IF NOT EXISTS file_change_entries (
      thread_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      ts_ms INTEGER NOT NULL,
      path TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'change',
      added_lines INTEGER NOT NULL DEFAULT 0,
      deleted_lines INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(thread_id, message_id, path)
    );

    CREATE INDEX IF NOT EXISTS idx_file_change_entries_thread_ts_message
      ON file_change_entries(thread_id, ts_ms, message_id);

    -- threads：会话列表线程摘要持久化表，默认列表读取直接命中本表。
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      preview TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      cwd TEXT NOT NULL DEFAULT '',
      model_provider TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_threads_updated_at
      ON threads(updated_at DESC, created_at DESC, id ASC);

    CREATE INDEX IF NOT EXISTS idx_threads_cwd_updated_at
      ON threads(cwd, updated_at DESC, created_at DESC, id ASC);
  `);
}
//# sourceMappingURL=schema.js.map