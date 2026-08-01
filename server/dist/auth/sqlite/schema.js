"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyAuthSchema = applyAuthSchema;
/**
 * 初始化认证与工作区设置相关表结构。
 */
function applyAuthSchema(db) {
    db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;

    CREATE TABLE IF NOT EXISTS auth_users (
      username TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_user_assigned_workspaces (
      username TEXT NOT NULL,
      workspace_path TEXT NOT NULL,
      ord INTEGER NOT NULL,
      PRIMARY KEY(username, workspace_path)
    );

    CREATE INDEX IF NOT EXISTS idx_auth_assigned_workspaces_username_ord
      ON auth_user_assigned_workspaces(username, ord);

    CREATE TABLE IF NOT EXISTS auth_user_workspace_dirs (
      username TEXT NOT NULL,
      workspace_dir TEXT NOT NULL,
      ord INTEGER NOT NULL,
      PRIMARY KEY(username, workspace_dir)
    );

    CREATE INDEX IF NOT EXISTS idx_auth_workspace_dirs_username_ord
      ON auth_user_workspace_dirs(username, ord);

    CREATE TABLE IF NOT EXISTS auth_user_settings (
      username TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_server_secrets (
      secret_key TEXT PRIMARY KEY,
      secret_value TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_user_git_credentials (
      id TEXT PRIMARY KEY,
      owner_username TEXT NOT NULL,
      label TEXT NOT NULL,
      host TEXT NOT NULL,
      protocol TEXT NOT NULL,
      credential_type TEXT NOT NULL,
      credential_username TEXT NOT NULL,
      secret_encrypted TEXT NOT NULL,
      has_passphrase INTEGER NOT NULL,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_auth_user_git_credentials_owner_updated
      ON auth_user_git_credentials(owner_username, updated_at_ms DESC);

    CREATE INDEX IF NOT EXISTS idx_auth_user_git_credentials_owner_remote
      ON auth_user_git_credentials(owner_username, host, protocol, updated_at_ms DESC);

    CREATE TABLE IF NOT EXISTS auth_git_pushed_commits (
      repo_root TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      commit_hash TEXT NOT NULL,
      pushed_at TEXT NOT NULL,
      PRIMARY KEY(repo_root, branch_name, commit_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_auth_git_pushed_commits_repo_branch_pushed_at
      ON auth_git_pushed_commits(repo_root, branch_name, pushed_at DESC);

    CREATE TABLE IF NOT EXISTS auth_user_thread_status (
      username TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      cwd TEXT NOT NULL,
      is_running INTEGER NOT NULL,
      is_pending INTEGER NOT NULL,
      has_completed_unread INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      PRIMARY KEY(username, thread_id)
    );

    CREATE INDEX IF NOT EXISTS idx_auth_user_thread_status_username_cwd
      ON auth_user_thread_status(username, cwd);
  `);
}
//# sourceMappingURL=schema.js.map