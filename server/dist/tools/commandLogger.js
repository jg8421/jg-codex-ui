"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCommandForLog = formatCommandForLog;
exports.logCommandExecution = logCommandExecution;
exports.logCodexTurnStart = logCodexTurnStart;
exports.logCodexCommandExecution = logCodexCommandExecution;
exports.logCodexTurnError = logCodexTurnError;
exports.logCodexCommandExecutionError = logCodexCommandExecutionError;
exports.logGitCommitSummaryRoute = logGitCommitSummaryRoute;
exports.logGitCommitSummaryRouteError = logGitCommitSummaryRouteError;
exports.logGitCommitSummaryCli = logGitCommitSummaryCli;
/**
 * 无需额外引号即可安全展示的命令片段模式。
 */
const PLAIN_COMMAND_PART_PATTERN = /^[A-Za-z0-9_./:=@%+-]+$/;
/**
 * 用户消息日志预览长度上限：避免把超长 prompt 整条打进后端日志。
 */
const MESSAGE_PREVIEW_MAX_CHARS = 160;
/**
 * 将单个 argv 片段格式化为便于日志阅读的文本。
 */
function formatCommandPart(part) {
    const normalizedPart = String(part ?? "");
    if (normalizedPart && PLAIN_COMMAND_PART_PATTERN.test(normalizedPart)) {
        return normalizedPart;
    }
    return toBashDollarSingleQuoted(normalizedPart);
}
/**
 * 将文本编码为 bash 安全的 `$'...'` 字面量，便于从日志复制粘贴执行。
 *
 * 说明：
 * - 该格式不会触发 `$()`、反引号等命令替换；
 * - 通过 `\n` 等转义保持日志单行，避免多行 prompt 刷屏；
 * - 目标是“可复制可复现”，不是生成最短字符串。
 */
function toBashDollarSingleQuoted(value) {
    const text = String(value ?? "");
    let out = "";
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === "\\")
            out += "\\\\";
        else if (ch === "'")
            out += "\\'";
        else if (ch === "\n")
            out += "\\n";
        else if (ch === "\r")
            out += "\\r";
        else if (ch === "\t")
            out += "\\t";
        else {
            const code = ch.codePointAt(0) ?? 0;
            // 其它控制字符用 \xNN 形式，避免直接把不可见字符打进日志。
            if (code >= 0 && code < 32) {
                out += `\\x${code.toString(16).padStart(2, "0")}`;
            }
            else {
                out += ch;
            }
        }
    }
    return `$'${out}'`;
}
/**
 * 规范化长文本预览：折叠空白并截断，避免日志刷屏。
 */
function formatTextPreview(text) {
    const normalizedText = String(text ?? "").replace(/\s+/g, " ").trim();
    if (normalizedText.length <= MESSAGE_PREVIEW_MAX_CHARS) {
        return normalizedText;
    }
    return `${normalizedText.slice(0, MESSAGE_PREVIEW_MAX_CHARS - 1)}...`;
}
/**
 * 规范化错误对象，尽量输出 message/code/data，而不是裸 `[object Object]`。
 */
function formatErrorPreview(error) {
    const errorRecord = error;
    const errorMessage = typeof errorRecord?.message === "string" ? errorRecord.message : String(error ?? "");
    const errorCode = errorRecord?.code;
    const errorData = errorRecord?.data;
    const detailParts = [errorMessage.trim() || "unknown error"];
    if (errorCode !== undefined && errorCode !== null && String(errorCode).trim()) {
        detailParts.push(`code=${String(errorCode).trim()}`);
    }
    if (errorData !== undefined && errorData !== null && String(errorData).trim()) {
        detailParts.push(`data=${formatTextPreview(String(errorData))}`);
    }
    return detailParts.join(" ");
}
/**
 * 将命令与参数拼接为稳定、可读的日志文本。
 */
function formatCommandForLog(command, args) {
    const commandParts = [String(command ?? ""), ...args.map((arg) => String(arg ?? ""))];
    return commandParts.map((part) => formatCommandPart(part)).join(" ");
}
/**
 * 打印后端实际执行的外部命令日志。
 *
 * 说明：
 * - 只输出命令文本与 cwd，不打印环境变量，避免敏感信息泄漏；
 * - 使用统一前缀，便于在服务端日志里筛选。
 */
function logCommandExecution(input) {
    const timestampText = new Date().toISOString();
    const commandText = formatCommandForLog(input.command, input.args);
    const cwdText = typeof input.cwd === "string" && input.cwd.trim() ? input.cwd : process.cwd();
    const cwdLogText = formatCommandPart(cwdText);
    console.info(`[command] ${timestampText} source=${input.source} cwd=${cwdLogText} command=${commandText}`);
}
/**
 * 打印用户发消息后触发的 `turn/start` 请求摘要。
 */
function logCodexTurnStart(input) {
    const timestampText = new Date().toISOString();
    const threadIdText = formatCommandPart(String(input.threadId ?? "").trim() || "unknown");
    const textPreview = formatCommandPart(formatTextPreview(input.text));
    const optionParts = [
        input.model ? `model=${formatCommandPart(String(input.model))}` : "",
        input.effort ? `effort=${formatCommandPart(String(input.effort))}` : "",
        input.serviceTier ? `serviceTier=${formatCommandPart(String(input.serviceTier))}` : "",
        input.approvalPolicy ? `approvalPolicy=${formatCommandPart(String(input.approvalPolicy))}` : "",
        input.sandbox ? `sandbox=${formatCommandPart(String(input.sandbox))}` : "",
    ].filter(Boolean);
    const optionText = optionParts.length ? ` ${optionParts.join(" ")}` : "";
    console.info(`[codex-turn] ${timestampText} method=turn/start threadId=${threadIdText} text=${textPreview}${optionText}`);
}
/**
 * 打印 Codex 在执行过程中实际跑起的命令。
 */
function logCodexCommandExecution(input) {
    const timestampText = new Date().toISOString();
    const threadIdText = formatCommandPart(String(input.threadId ?? "").trim() || "unknown");
    const turnIdText = formatCommandPart(String(input.turnId ?? "").trim() || "unknown");
    const itemIdText = formatCommandPart(String(input.itemId ?? "").trim() || "unknown");
    const commandText = formatCommandPart(String(input.command ?? "").trim());
    console.info(`[codex-command] ${timestampText} threadId=${threadIdText} turnId=${turnIdText} itemId=${itemIdText} command=${commandText}`);
}
/**
 * 打印 `turn/start` 等请求失败日志。
 */
function logCodexTurnError(input) {
    const timestampText = new Date().toISOString();
    const threadIdText = formatCommandPart(String(input.threadId ?? "").trim() || "unknown");
    const methodText = formatCommandPart(String(input.method ?? "").trim() || "unknown");
    const errorText = formatCommandPart(formatErrorPreview(input.error));
    console.error(`[codex-turn-error] ${timestampText} method=${methodText} threadId=${threadIdText} error=${errorText}`);
}
/**
 * 打印执行中的命令失败日志，补充退出码和错误输出摘要。
 */
function logCodexCommandExecutionError(input) {
    const timestampText = new Date().toISOString();
    const threadIdText = formatCommandPart(String(input.threadId ?? "").trim() || "unknown");
    const turnIdText = formatCommandPart(String(input.turnId ?? "").trim() || "unknown");
    const itemIdText = formatCommandPart(String(input.itemId ?? "").trim() || "unknown");
    const commandText = formatCommandPart(String(input.command ?? "").trim());
    const exitCodeText = typeof input.exitCode === "number" && Number.isFinite(input.exitCode) ? ` exitCode=${Math.floor(input.exitCode)}` : "";
    const statusText = input.status ? ` status=${formatCommandPart(String(input.status))}` : "";
    const detailsText = input.details ? ` details=${formatCommandPart(formatTextPreview(String(input.details)))}` : "";
    console.error(`[codex-command-error] ${timestampText} threadId=${threadIdText} turnId=${turnIdText} itemId=${itemIdText} command=${commandText}${exitCodeText}${statusText}${detailsText}`);
}
/**
 * 打印 Git 智能总结路由层日志，便于区分“请求已到达”和“是否已产出总结结果”。
 */
function logGitCommitSummaryRoute(input) {
    const timestampText = new Date().toISOString();
    const stageText = formatCommandPart(String(input.stage ?? "").trim() || "unknown");
    const usernameText = formatCommandPart(String(input.username ?? "").trim() || "unknown");
    const cwdText = formatCommandPart(String(input.cwd ?? "").trim() || "unknown");
    const fileCountText = typeof input.fileCount === "number" && Number.isFinite(input.fileCount) ? ` fileCount=${Math.floor(input.fileCount)}` : "";
    const modelText = input.model ? ` model=${formatCommandPart(String(input.model).trim())}` : "";
    const effortText = input.effort ? ` effort=${formatCommandPart(String(input.effort).trim())}` : "";
    const sandboxText = input.sandbox ? ` sandbox=${formatCommandPart(String(input.sandbox).trim())}` : "";
    const threadIdText = input.threadId ? ` threadId=${formatCommandPart(String(input.threadId).trim())}` : "";
    console.info(`[git-summary] ${timestampText} stage=${stageText} username=${usernameText} cwd=${cwdText}${fileCountText}${modelText}${effortText}${sandboxText}${threadIdText}`);
}
/**
 * 打印 Git 智能总结路由层错误日志，便于识别“尚未进入 codex exec 就失败”的场景。
 */
function logGitCommitSummaryRouteError(input) {
    const timestampText = new Date().toISOString();
    const stageText = formatCommandPart(String(input.stage ?? "").trim() || "unknown");
    const usernameText = formatCommandPart(String(input.username ?? "").trim() || "unknown");
    const cwdText = formatCommandPart(String(input.cwd ?? "").trim() || "unknown");
    const fileCountText = typeof input.fileCount === "number" && Number.isFinite(input.fileCount) ? ` fileCount=${Math.floor(input.fileCount)}` : "";
    const modelText = input.model ? ` model=${formatCommandPart(String(input.model).trim())}` : "";
    const effortText = input.effort ? ` effort=${formatCommandPart(String(input.effort).trim())}` : "";
    const sandboxText = input.sandbox ? ` sandbox=${formatCommandPart(String(input.sandbox).trim())}` : "";
    const errorText = formatCommandPart(formatErrorPreview(input.error));
    console.error(`[git-summary-error] ${timestampText} stage=${stageText} username=${usernameText} cwd=${cwdText}${fileCountText}${modelText}${effortText}${sandboxText} error=${errorText}`);
}
/**
 * 打印 Git 智能总结在 `codex exec` 执行前后的阶段日志。
 */
function logGitCommitSummaryCli(input) {
    const timestampText = new Date().toISOString();
    const stageText = formatCommandPart(String(input.stage ?? "").trim() || "unknown");
    const cwdText = formatCommandPart(String(input.cwd ?? "").trim() || "unknown");
    const repoRootText = formatCommandPart(String(input.repoRoot ?? "").trim() || "unknown");
    const fileCountText = typeof input.fileCount === "number" && Number.isFinite(input.fileCount) ? ` fileCount=${Math.floor(input.fileCount)}` : "";
    const modelText = input.model ? ` model=${formatCommandPart(String(input.model).trim())}` : "";
    const effortText = input.effort ? ` effort=${formatCommandPart(String(input.effort).trim())}` : "";
    const sandboxText = input.sandbox ? ` sandbox=${formatCommandPart(String(input.sandbox).trim())}` : "";
    const exitCodeText = typeof input.exitCode === "number" && Number.isFinite(input.exitCode) ? ` exitCode=${Math.floor(input.exitCode)}` : "";
    const hasRawTextText = typeof input.hasRawText === "boolean" ? ` hasRawText=${input.hasRawText}` : "";
    const hasMessageText = typeof input.hasMessage === "boolean" ? ` hasMessage=${input.hasMessage}` : "";
    const rawTextPreviewText = input.rawTextPreview
        ? ` rawTextPreview=${formatCommandPart(formatTextPreview(String(input.rawTextPreview)))}`
        : "";
    console.info(`[git-summary-cli] ${timestampText} stage=${stageText} cwd=${cwdText} repoRoot=${repoRootText}${fileCountText}${modelText}${effortText}${sandboxText}${exitCodeText}${hasRawTextText}${hasMessageText}${rawTextPreviewText}`);
}
//# sourceMappingURL=commandLogger.js.map