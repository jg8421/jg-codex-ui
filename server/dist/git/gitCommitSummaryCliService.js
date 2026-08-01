"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGitCommitSummaryCodexExecArgs = buildGitCommitSummaryCodexExecArgs;
exports.summarizeGitCommitViaCodexExec = summarizeGitCommitViaCodexExec;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const codexSpawn_1 = require("../codex/codexSpawn");
const commandLogger_1 = require("../tools/commandLogger");
const gitCommitSummaryResult_1 = require("./gitCommitSummaryResult");
const gitCommitSummaryRuntimeOptions_1 = require("./gitCommitSummaryRuntimeOptions");
const gitCommitSummaryService_1 = require("./gitCommitSummaryService");
const CONVENTIONAL_COMMIT_MESSAGE_RE = /^(feat|fix|docs|refactor|test|chore)(\([^)]+\))?!?:\s+\S+/i;
/**
 * 创建 `codex exec --output-last-message` 的临时输出文件路径。
 */
async function createOutputLastMessageFile() {
    // tmpRoot：系统临时目录。
    const tmpRoot = node_os_1.default.tmpdir();
    // dir：为本次请求创建独立临时目录，便于清理与隔离并发。
    const dir = await promises_1.default.mkdtemp(node_path_1.default.join(tmpRoot, "codex-git-commit-summary-"));
    // filePath：固定文件名，内容由 codex 写入最后一条消息文本。
    const filePath = node_path_1.default.join(dir, "last_message.txt");
    return { dir, filePath };
}
/**
 * 读取 `--output-last-message` 的内容；失败时返回空串。
 */
async function readOutputLastMessageFile(filePath) {
    // normalizedPath：规整路径，避免空白导致读取异常。
    const normalizedPath = String(filePath ?? "").trim();
    if (!normalizedPath)
        return "";
    try {
        const content = await promises_1.default.readFile(normalizedPath, "utf8");
        return String(content ?? "").trim();
    }
    catch {
        return "";
    }
}
/**
 * 带短暂重试的 `--output-last-message` 读取：
 * - 处理 codex 进程退出与文件落盘之间的极短竞态；
 * - 只在首次读取为空时才进入重试，避免无谓等待。
 */
async function readOutputLastMessageFileWithRetry(input) {
    // firstTry：首次读取结果。
    const firstTry = await readOutputLastMessageFile(input.filePath);
    if (firstTry)
        return firstTry;
    // maxWaitMs：最大等待时长（ms）。
    const maxWaitMs = Number.isFinite(input.maxWaitMs) ? Math.max(0, Math.floor(input.maxWaitMs)) : 0;
    // pollIntervalMs：轮询间隔（ms）。
    const pollIntervalMs = Number.isFinite(input.pollIntervalMs) ? Math.max(10, Math.floor(input.pollIntervalMs)) : 50;
    // startAtMs：开始等待的时间戳。
    const startAtMs = Date.now();
    while (Date.now() - startAtMs < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        const content = await readOutputLastMessageFile(input.filePath);
        if (content)
            return content;
    }
    return "";
}
/**
 * 读取 env 的整数值；失败返回 undefined（由调用方决定默认值）。
 */
function parseIntEnvOrUndefined(value) {
    // raw：环境变量原始文本。
    const raw = String(value ?? "").trim();
    if (!raw)
        return undefined;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed))
        return undefined;
    return Math.max(0, Math.floor(parsed));
}
/**
 * 清理临时输出目录（best-effort）。
 */
async function cleanupOutputLastMessageFile(dir) {
    // normalizedDir：规整路径，避免误删。
    const normalizedDir = String(dir ?? "").trim();
    if (!normalizedDir)
        return;
    await promises_1.default.rm(normalizedDir, { recursive: true, force: true }).catch(() => undefined);
}
/**
 * 解析 env 的整数值；失败则回退到默认值。
 */
function parseIntEnvOrFallback(input) {
    // raw：环境变量原始文本。
    const raw = String(input.value ?? "").trim();
    if (!raw)
        return input.fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed))
        return input.fallback;
    return Math.max(0, Math.floor(parsed));
}
/**
 * 解析 env 的 TOML 片段（作为 `codex -c key=value` 的 value 部分）。
 * 说明：这里只做轻量校验，避免写死复杂解析；默认允许用户直接传 `[]` / `["a"]` 等 TOML/JSON 兼容片段。
 */
function parseTomlSnippetEnvOrFallback(input) {
    // raw：环境变量原始文本。
    const raw = String(input.value ?? "").trim();
    if (!raw)
        return input.fallback;
    // 若用户传了明显的换行/空字节，直接回退，避免拼接 argv 时引入意外格式。
    if (raw.includes("\0"))
        return input.fallback;
    return raw;
}
/**
 * 判断未知值是否为普通对象，供 JSONL 事件递归遍历复用。
 */
function isJsonRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
/**
 * 判断对象是否长得像 Git 总结结果：
 * - 必须有非空 `message` 字符串；
 * - `overview` 可为数组或字符串。
 */
function isGitCommitSummaryPayload(value) {
    if (!isJsonRecord(value))
        return false;
    const message = String(value.message ?? "").trim();
    if (!message)
        return false;
    if (!CONVENTIONAL_COMMIT_MESSAGE_RE.test(message))
        return false;
    return Array.isArray(value.overview) || typeof value.overview === "string" || !("overview" in value);
}
/**
 * 递归查找 JSONL 事件里的 Git 总结结果对象。
 *
 * 说明：
 * - 逆序遍历对象字段与数组元素，让“最后一次出现的最终结果”优先命中；
 * - 只返回 CLI 事件对象内部真实存在的 payload，不会去解析字符串中的 user prompt JSON 示例。
 */
function findGitCommitSummaryPayloadDeep(value) {
    if (isGitCommitSummaryPayload(value)) {
        return value;
    }
    if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index -= 1) {
            const nested = findGitCommitSummaryPayloadDeep(value[index]);
            if (nested)
                return nested;
        }
        return null;
    }
    if (!isJsonRecord(value))
        return null;
    const entries = Object.entries(value);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [, nestedValue] = entries[index] ?? [];
        const nested = findGitCommitSummaryPayloadDeep(nestedValue);
        if (nested)
            return nested;
    }
    return null;
}
/**
 * 从 `codex exec --json` 的 stdout JSONL 中恢复最终 Git 总结文本。
 *
 * 返回值是序列化后的 JSON 字符串，便于复用现有结果解析与规范化流程。
 */
function extractGitCommitSummaryFromJsonlStdout(stdoutText) {
    // normalizedStdout：统一换行与首尾空白，便于逐行解析。
    const normalizedStdout = String(stdoutText ?? "").replace(/\r\n/g, "\n").trim();
    if (!normalizedStdout)
        return "";
    // lines：JSONL 每行一个事件；空行直接忽略。
    const lines = normalizedStdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index] ?? "";
        try {
            // parsedLine：单行 JSON 事件。
            const parsedLine = JSON.parse(line);
            const payload = findGitCommitSummaryPayloadDeep(parsedLine);
            if (!payload)
                continue;
            return JSON.stringify(payload);
        }
        catch {
            // ignore：只要有一行不是 JSON，就继续尝试上一行。
        }
    }
    return "";
}
/**
 * 获取 `--output-last-message` 读取的等待窗口（ms）。
 *
 * 说明：
 * - codex 进程退出与文件落盘之间可能存在极短竞态；
 * - 默认等待 2000ms，避免在慢盘/高负载场景下误判为“无输出”；
 * - 支持用 env 临时调参：`CODEX_GIT_COMMIT_SUMMARY_OUTPUT_LAST_MESSAGE_MAX_WAIT_MS`。
 */
function resolveOutputLastMessageMaxWaitMs() {
    // fromEnv：环境变量可选覆盖（便于线上排障/调参）。
    const fromEnv = parseIntEnvOrUndefined(process.env.CODEX_GIT_COMMIT_SUMMARY_OUTPUT_LAST_MESSAGE_MAX_WAIT_MS);
    if (typeof fromEnv === "number")
        return Math.max(0, fromEnv);
    return 2_000;
}
/**
 * 生成本次总结可尝试的文本候选列表。
 *
 * 说明：
 * - 这里只负责收集来源，不提前裁决哪个来源“更可信”；
 * - `stdout-jsonl` 与普通 `stdout` 同时保留，避免结构化恢复失败时丢失纯文本兜底。
 */
function buildGitCommitSummaryTextCandidates(input) {
    // candidateEntries：按优先级排列的原始来源列表。
    const candidateEntries = [
        { source: "output-last-message", text: String(input.rawTextFromFile ?? "").trim() },
        { source: "stdout-jsonl", text: String(input.rawTextFromJsonlStdout ?? "").trim() },
        { source: "stdout", text: String(input.rawTextFromStdout ?? "").trim() },
        { source: "stderr", text: String(input.rawTextFromStderr ?? "").trim() },
    ];
    return candidateEntries.filter((candidate) => Boolean(candidate.text));
}
/**
 * 从多个文本来源中挑选第一个“可解析出有效 commit message”的结果。
 *
 * 说明：
 * - 不是“第一个非空文本”获胜，而是“第一个可用总结”获胜；
 * - 若全部来源都不可用，仍返回第一段非空文本用于日志诊断。
 */
function resolveGitCommitSummaryText(candidates) {
    // firstNonEmptyText：保留首个非空来源，便于失败时输出诊断预览。
    const firstNonEmptyText = String(candidates[0]?.text ?? "").trim();
    for (const candidate of candidates) {
        // message：从当前候选文本中提取的 commit message。
        const message = (0, gitCommitSummaryResult_1.extractCommitSummaryMessage)(candidate.text);
        if (!message)
            continue;
        return {
            rawText: candidate.text,
            message,
            source: candidate.source,
            firstNonEmptyText,
        };
    }
    return {
        rawText: firstNonEmptyText,
        message: "",
        source: null,
        firstNonEmptyText,
    };
}
/**
 * 构建“git 智能总结”专用的 codex `-c` 覆盖项：
 * - 目标是减少 `AGENTS.md` 等项目文档的注入体积，从而加快总结；
 * - 只作用于本次 `codex exec` 调用，不修改用户的 `~/.codex/config.toml`。
 */
function buildGitCommitSummaryProjectDocOverridesFromEnv() {
    // maxBytes：限制每个项目文档最多读取的字节数；默认 1，等效“几乎不读”。
    const maxBytes = parseIntEnvOrFallback({
        value: process.env.CODEX_GIT_COMMIT_SUMMARY_PROJECT_DOC_MAX_BYTES,
        fallback: 1,
    });
    // fallbackFilenames：禁用 fallback 文件名列表，避免 `AGENTS.md` 不存在时去读其它大文档；默认空数组。
    const fallbackFilenames = parseTomlSnippetEnvOrFallback({
        value: process.env.CODEX_GIT_COMMIT_SUMMARY_PROJECT_DOC_FALLBACK_FILENAMES,
        fallback: "[]",
    });
    return [
        { key: "project_doc_max_bytes", valueToml: String(maxBytes) },
        { key: "project_doc_fallback_filenames", valueToml: fallbackFilenames },
    ];
}
/**
 * 将 git 总结的 sandbox 参数映射到 codex CLI 的 `--sandbox` 值。
 */
function toCodexCliSandboxValue(sandbox) {
    if (sandbox === "danger-full-access")
        return "danger-full-access";
    if (sandbox === "read-only")
        return "read-only";
    return "workspace-write";
}
/**
 * 构建本次 `codex exec` 的 argv。
 */
function buildGitCommitSummaryCodexExecArgs(input) {
    // args：最终传给 `codex` 的参数数组。
    const args = ["exec", "--ephemeral", "-C", input.cwd, "--sandbox", toCodexCliSandboxValue(input.sandbox)];
    // approval_policy：非交互服务端调用，避免阻塞等待人工确认；默认强制 `never`。
    args.push("-c", `approval_policy="never"`);
    // --json：要求 stdout 输出 JSONL 事件流，便于在 output-last-message 为空时恢复最终结果。
    args.push("--json");
    // outputLastMessagePath：稳定获取最终 assistant 文本的输出路径（避免依赖 stdout）。
    const outputLastMessagePath = String(input.outputLastMessagePath ?? "").trim();
    if (outputLastMessagePath)
        args.push("--output-last-message", outputLastMessagePath);
    // model：可选的模型覆盖。
    const model = String(input.model ?? "").trim();
    if (model)
        args.push("-m", model);
    // model_reasoning_effort：可选的思考强度覆盖；使用 TOML 字符串字面量。
    const effort = String(input.effort ?? "").trim();
    if (effort)
        args.push("-c", `model_reasoning_effort="${effort.replace(/"/g, '\\"')}"`);
    // project doc overrides：减少 `AGENTS.md` 注入体积（加速 git 总结）。
    const overrides = buildGitCommitSummaryProjectDocOverridesFromEnv();
    for (const override of overrides) {
        args.push("-c", `${override.key}=${override.valueToml}`);
    }
    // promptText：最后一个参数为用户提示词。
    args.push(input.promptText);
    return args;
}
/**
 * 使用 `codex exec` 生成 Git 提交智能总结：
 * - 通过 `-c project_doc_max_bytes=...` 等覆盖项，减少 `AGENTS.md` 注入体积；
 * - 仅依赖 stdout 返回的 assistant 文本，不依赖 app-server 的 thread/history 管道。
 */
async function summarizeGitCommitViaCodexExec(input) {
    // prepared：复用统一的 repo/status 过滤与 prompt 组装。
    const prepared = await (0, gitCommitSummaryService_1.prepareGitCommitSummary)({ cwd: input.cwd, requestedFiles: input.requestedFiles });
    // outputFile：codex 写入最终消息的临时文件（用于稳定获取 assistant 文本）。
    const outputFile = await createOutputLastMessageFile();
    try {
        // argv：本次 codex exec 的启动参数。
        const argv = buildGitCommitSummaryCodexExecArgs({
            cwd: prepared.repoRoot,
            promptText: prepared.promptText,
            model: input.model,
            effort: input.effort,
            sandbox: input.sandbox,
            outputLastMessagePath: outputFile.filePath,
        });
        // runner：默认使用真实子进程执行；测试可注入 stub。
        const runner = input.runCommand ?? codexSpawn_1.runCodexCommand;
        // timeoutMs：优先使用调用方显式值，否则回退到 Git 总结专用默认超时。
        const timeoutMs = typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs)
            ? Math.max(1000, Math.floor(input.timeoutMs))
            : (0, gitCommitSummaryRuntimeOptions_1.resolveGitCommitSummaryTimeoutMs)();
        (0, commandLogger_1.logGitCommitSummaryCli)({
            stage: "codex-exec-start",
            cwd: input.cwd,
            repoRoot: prepared.repoRoot,
            fileCount: prepared.promptFiles.length,
            model: input.model ?? null,
            effort: input.effort ?? null,
            sandbox: input.sandbox,
        });
        const result = await runner({
            codexBin: String(input.codexBin ?? "").trim() || "codex",
            args: argv,
            cwd: prepared.repoRoot,
            timeoutMs,
        });
        // rawTextFromFile：读取 output-last-message 内容（更稳定，但不再直接短路后续来源）。
        const rawTextFromFile = await readOutputLastMessageFileWithRetry({
            filePath: outputFile.filePath,
            maxWaitMs: resolveOutputLastMessageMaxWaitMs(),
            pollIntervalMs: 50,
        });
        // rawTextFromStdout：stdout 原始文本；可能是 JSONL、transcript 或普通文本。
        const rawTextFromStdout = String(result.stdout ?? "").trim();
        // rawTextFromJsonlStdout：无论 output-last-message 是否存在，都尝试从 JSONL 事件里恢复最终总结。
        const rawTextFromJsonlStdout = extractGitCommitSummaryFromJsonlStdout(rawTextFromStdout);
        // rawTextFromStderr：部分环境会把最终输出分流到 stderr；此处做兜底回收。
        const rawTextFromStderr = String(result.stderr ?? "").trim();
        // summaryTextCandidates：按优先级排列的所有非空文本来源。
        const summaryTextCandidates = buildGitCommitSummaryTextCandidates({
            rawTextFromFile,
            rawTextFromJsonlStdout,
            rawTextFromStdout,
            rawTextFromStderr,
        });
        // resolvedSummaryText：从候选来源中挑选出的首个“可用总结”。
        const resolvedSummaryText = resolveGitCommitSummaryText(summaryTextCandidates);
        // rawText：最终用于规范化与返回的 assistant 文本。
        const rawText = resolvedSummaryText.rawText;
        // exitCode：子进程退出码；非 0 时通常代表请求失败，但如果仍能解析出 message，则尽量返回可用结果。
        const exitCode = Number(result.exitCode ?? 1);
        // message：从可用候选文本中抽取出的单行 commit message。
        const message = resolvedSummaryText.message;
        (0, commandLogger_1.logGitCommitSummaryCli)({
            stage: "codex-exec-finished",
            cwd: input.cwd,
            repoRoot: prepared.repoRoot,
            fileCount: prepared.promptFiles.length,
            model: input.model ?? null,
            effort: input.effort ?? null,
            sandbox: input.sandbox,
            exitCode,
            hasRawText: Boolean(rawText),
            hasMessage: Boolean(message),
            rawTextPreview: rawText && !message ? resolvedSummaryText.firstNonEmptyText : null,
        });
        if (exitCode !== 0) {
            if (message) {
                const normalizedRawText = (0, gitCommitSummaryResult_1.buildNormalizedCommitSummaryText)({
                    rawText,
                    message,
                    fallbackOverviewLines: prepared.promptFiles.map((file) => `- [${file.crudLabel}] ${file.path}`),
                });
                return { threadId: "cli-exec", message, rawText: normalizedRawText };
            }
            throw new Error(result.stderr || rawTextFromStdout || `codex exec failed (exitCode=${exitCode})`);
        }
        if (!rawText) {
            // 明确区分“进程成功但完全无输出”场景，便于前端提示与排障。
            throw new Error("git commit summary empty output");
        }
        if (!message)
            throw new Error("git commit summary message missing");
        // normalizedRawText：统一补齐“变更概要”段落，避免前端显示原始不稳定文本。
        const normalizedRawText = (0, gitCommitSummaryResult_1.buildNormalizedCommitSummaryText)({
            rawText,
            message,
            fallbackOverviewLines: prepared.promptFiles.map((file) => `- [${file.crudLabel}] ${file.path}`),
        });
        return { threadId: "cli-exec", message, rawText: normalizedRawText };
    }
    finally {
        await cleanupOutputLastMessageFile(outputFile.dir);
    }
}
//# sourceMappingURL=gitCommitSummaryCliService.js.map