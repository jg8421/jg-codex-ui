/**
 * 判断当前运行环境是否为 Windows。
 * Determine whether current platform is Windows.
 */
export declare function isWindowsPlatform(): boolean;
/**
 * 判断是否需要通过 shell 启动 codex。
 *
 * 说明：
 * - Windows 下如果 `codex` 是 npm shim，通常以 `codex.cmd`/`codex.bat` 形式存在；
 *   这类脚本需要 `cmd.exe` 参与解析，`shell: true` 更稳妥。
 * - 如果用户配置的是绝对路径（尤其包含空格，例如 `C:\\Program Files\\...\\codex.exe`），
 *   使用 shell 更容易遇到引号/空格解析问题，因此优先直接执行文件（`shell: false`）。
 *
 * Decide whether to use shell to launch Codex on Windows.
 */
export declare function shouldUseShellForCodexBin(codexBin: string): boolean;
type RunCommandResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
};
/**
 * 以子进程方式运行 codex，并收集 stdout/stderr。
 * Run codex as a subprocess and collect stdout/stderr.
 */
export declare function runCodexCommand(opts: {
    codexBin: string;
    args: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number | null;
}): Promise<RunCommandResult>;
export {};
