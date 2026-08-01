"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareGitCommitSummary = prepareGitCommitSummary;
exports.summarizeGitCommit = summarizeGitCommit;
const node_path_1 = __importDefault(require("node:path"));
const gitCommitSummaryPrompt_1 = require("./gitCommitSummaryPrompt");
const gitCommitSummaryResult_1 = require("./gitCommitSummaryResult");
const gitCommand_1 = require("./gitCommand");
const gitStatusPorcelain_1 = require("./gitStatusPorcelain");
/**
 * 将 Git status 文件映射为 CRUD 类型。
 */
function resolveCrudKindFromGitStatusFile(file) {
    const x = String(file.x ?? "").trim();
    const y = String(file.y ?? "").trim();
    const hasRename = Boolean(String(file.renamedFrom ?? "").trim());
    if (x === "D" || y === "D")
        return "delete";
    if (hasRename || x === "R" || y === "R")
        return "rename";
    if (file.untracked || x === "A" || y === "A")
        return "create";
    return "update";
}
/**
 * 将 CRUD 类型映射为中文标签。
 */
function resolveCrudLabel(kind) {
    if (kind === "create")
        return "新增";
    if (kind === "delete")
        return "删除";
    if (kind === "rename")
        return "重命名";
    return "修改";
}
/**
 * 当模型未返回正文时，基于已选文件生成最小可用的“变更概要”。
 */
function buildFallbackOverviewLines(files) {
    // previewFiles：只取前几项，避免输出区过长。
    const previewFiles = files.slice(0, 5);
    if (!previewFiles.length) {
        return ["- 涉及已勾选变更文件，但模型未返回可展示的明细。"];
    }
    return previewFiles.map((file) => `- [${file.crudLabel}] ${file.path}`);
}
/**
 * 准备 Git 提交总结所需的 prompt 与文件清单（不触发 Codex 调用）。
 */
async function prepareGitCommitSummary(input) {
    // requestedCwd：调用方传入的工作目录（可为 repo 内子目录）。
    const requestedCwd = String(input.cwd ?? "").trim();
    if (!requestedCwd)
        throw new Error("cwd is required");
    // repoRoot：解析后的 Git 仓库根目录。
    const repoRoot = await resolveRepoRootFromCwd(requestedCwd);
    // snapshot：当前 Git 状态快照，用于限制允许总结的文件集合。
    const snapshot = await getGitSummarySnapshot(repoRoot);
    // allowedPathSet：只允许当前 status 中出现的路径。
    const allowedPathSet = new Set(snapshot.files.map((file) => file.path));
    // fileByPath：便于后续补充 CRUD 标签。
    const fileByPath = new Map(snapshot.files.map((file) => [file.path, file]));
    // normalizedFiles：规范化、去重并通过白名单过滤后的路径列表。
    const normalizedFiles = [];
    // seenPaths：去重集合。
    const seenPaths = new Set();
    const requestedFiles = Array.isArray(input.requestedFiles) ? input.requestedFiles : [];
    for (const rawFile of requestedFiles) {
        const normalizedPath = normalizeRequestedPathspec(repoRoot, rawFile);
        if (!normalizedPath)
            continue;
        if (!allowedPathSet.has(normalizedPath))
            continue;
        if (seenPaths.has(normalizedPath))
            continue;
        seenPaths.add(normalizedPath);
        normalizedFiles.push(normalizedPath);
    }
    if (!normalizedFiles.length) {
        throw new Error("no valid files selected");
    }
    // promptFiles：补齐 CRUD 标签后的提示词文件清单。
    const promptFiles = normalizedFiles.map((filePath) => {
        const gitFile = fileByPath.get(filePath);
        const crudKind = gitFile ? resolveCrudKindFromGitStatusFile(gitFile) : "update";
        return {
            path: filePath,
            crudLabel: resolveCrudLabel(crudKind),
        };
    });
    // promptText：最终发送给 Codex 的文本，只包含路径，不包含正文。
    const promptText = (0, gitCommitSummaryPrompt_1.buildGitCommitSummaryPrompt)({
        repoRoot,
        branchName: snapshot.branchName,
        files: promptFiles,
    });
    return { repoRoot, branchName: snapshot.branchName, promptText, promptFiles };
}
/**
 * 将任意仓库内 cwd 解析为真实 repoRoot。
 */
async function resolveRepoRootFromCwd(cwd) {
    // repoRootRes：读取当前 cwd 所属仓库根目录。
    const repoRootRes = await (0, gitCommand_1.runGitCommand)({ cwd, args: ["rev-parse", "--show-toplevel"] });
    if (repoRootRes.exitCode !== 0) {
        throw new Error(repoRootRes.stderr || repoRootRes.stdout || "not a git repository");
    }
    const repoRoot = String(repoRootRes.stdout ?? "").trim();
    if (!repoRoot)
        throw new Error("repo root missing");
    return repoRoot;
}
/**
 * 对单个 pathspec 做规范化，确保它是 repoRoot 下的相对路径。
 */
function normalizeRequestedPathspec(repoRoot, raw) {
    // candidate：客户端传来的原始路径。
    const candidate = typeof raw === "string" ? raw : "";
    // trimmed：去掉首尾空白后的路径。
    const trimmed = candidate.trim();
    if (!trimmed)
        return null;
    if (trimmed.includes("\0"))
        return null;
    if (node_path_1.default.isAbsolute(trimmed))
        return null;
    // resolved：将路径解析到 repoRoot 下，防止 `..` 越界。
    const resolved = node_path_1.default.resolve(repoRoot, trimmed);
    // relativePath：回写为 repoRoot 相对路径，保持前端路径语义一致。
    const relativePath = node_path_1.default.relative(repoRoot, resolved);
    if (!relativePath)
        return null;
    if (relativePath.startsWith("..") || node_path_1.default.isAbsolute(relativePath))
        return null;
    return relativePath;
}
/**
 * 从 Git 仓库读取当前状态快照（仅取 files 与 branch，满足总结场景即可）。
 */
async function getGitSummarySnapshot(repoRoot) {
    // branchRes：读取当前分支名。
    const branchRes = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: ["rev-parse", "--abbrev-ref", "HEAD"] });
    const branchName = branchRes.exitCode === 0 ? String(branchRes.stdout ?? "").trim() || "HEAD" : "HEAD";
    // statusRes：读取 status porcelain，作为允许文件集合。
    const statusRes = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--branch"],
    });
    if (statusRes.exitCode !== 0) {
        throw new Error(statusRes.stderr || statusRes.stdout || "git status failed");
    }
    const files = (0, gitStatusPorcelain_1.parseGitStatusPorcelainZ)(statusRes.stdout);
    return { branchName, files };
}
/**
 * 从历史消息中挑选最后一条“可作为最终总结”的 assistant 文本。
 */
function findLatestUsableCommitSummaryText(items) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
        // item：从后往前扫描，优先拿最后一条有效 assistant 文本。
        const item = items[index];
        const role = String(item?.role ?? "").trim();
        const text = String(item?.text ?? "").trim();
        const streaming = item?.streaming === true;
        if (role !== "assistant")
            continue;
        if (!text)
            continue;
        if (streaming)
            continue;
        if (!(0, gitCommitSummaryResult_1.extractCommitSummaryMessage)(text))
            continue;
        return text;
    }
    return "";
}
/**
 * 轮询历史消息，直到拿到最后一条可用 assistant 文本。
 */
async function waitForCommitSummaryText(input) {
    // timeoutMs：仅在“尚未观察到线程活跃”或“缺少活动信号”时使用的兜底等待时间。
    const timeoutMs = Number.isFinite(input.timeoutMs) ? Math.max(1000, Math.floor(input.timeoutMs)) : 30_000;
    // pollIntervalMs：轮询间隔，兼顾响应速度与开销。
    const pollIntervalMs = Number.isFinite(input.pollIntervalMs) ? Math.max(50, Math.floor(input.pollIntervalMs)) : 250;
    // completionGraceMs：线程结束后，额外等待 history 入库的宽限窗口。
    const completionGraceMs = Number.isFinite(input.completionGraceMs) && input.completionGraceMs !== undefined
        ? Math.max(0, Math.floor(input.completionGraceMs))
        : 1_500;
    // deadlineAtMs：尚未观测到线程活跃时的兜底截止时间。
    const deadlineAtMs = Date.now() + timeoutMs;
    // hasActivitySignal：调用方是否提供了线程活跃状态判断。
    const hasActivitySignal = typeof input.isThreadActive === "function";
    // observedActive：本次等待期间是否至少观测到一次线程活跃。
    let observedActive = false;
    // inactiveSinceMs：线程从活跃变为不活跃的起始时间；用于 completionGrace 判定。
    let inactiveSinceMs = null;
    while (true) {
        // items：线程当前可读到的历史消息。
        const items = await input.historyQuery.listMessages({ threadId: input.threadId, limit: 50, beforeTs: null });
        // candidateText：最后一条可作为最终总结的 assistant 文本；会跳过过程说明/plan 文本。
        const candidateText = findLatestUsableCommitSummaryText(items);
        // nowMs：当前轮询时刻，用于统一判定超时和结束宽限。
        const nowMs = Date.now();
        // threadActive：当前线程是否仍有活动 turn；仅在提供了活动信号时才参与判定。
        const threadActive = hasActivitySignal ? Boolean(input.isThreadActive?.(input.threadId)) : null;
        if (threadActive === true) {
            observedActive = true;
            inactiveSinceMs = null;
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            continue;
        }
        if (candidateText) {
            return candidateText;
        }
        if (threadActive === false && observedActive) {
            if (inactiveSinceMs === null)
                inactiveSinceMs = nowMs;
            if (nowMs - inactiveSinceMs >= completionGraceMs) {
                throw new Error("git commit summary finished without assistant text");
            }
        }
        if ((!hasActivitySignal || !observedActive) && nowMs > deadlineAtMs) {
            throw new Error("git commit summary timeout");
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
}
/**
 * 对外暴露的 Git 静默提交总结服务。
 */
async function summarizeGitCommit(input) {
    // prepared：Git 总结 prompt 预处理结果（repoRoot + promptText + CRUD 标签等）。
    const prepared = await prepareGitCommitSummary({ cwd: input.repoRoot, requestedFiles: input.requestedFiles });
    // repoRoot：解析后的 Git 仓库根目录。
    const repoRoot = prepared.repoRoot;
    // promptFiles：补齐 CRUD 标签后的提示词文件清单。
    const promptFiles = prepared.promptFiles;
    // promptText：最终发送给 Codex 的文本，只包含路径，不包含正文。
    const promptText = prepared.promptText;
    // createdThread：后台临时线程。
    const createdThread = await input.codex.startThread({
        cwd: input.codexCwd,
        model: input.model,
        serviceTier: input.serviceTier,
        approvalPolicy: input.approvalPolicy,
        sandbox: input.sandbox,
    });
    // threadId：新建线程 id。
    const threadId = String(createdThread?.id ?? "").trim();
    if (!threadId)
        throw new Error("threadId missing");
    try {
        await input.codex.startTurn(threadId, promptText, {
            model: input.model,
            effort: input.effort,
            serviceTier: input.serviceTier,
            approvalPolicy: input.approvalPolicy,
            sandbox: input.sandbox,
        });
        // rawText：最终 assistant 总结文本。
        const rawText = await waitForCommitSummaryText({
            historyQuery: input.historyQuery,
            threadId,
            isThreadActive: input.isThreadActive,
            timeoutMs: input.timeoutMs,
            pollIntervalMs: input.pollIntervalMs,
            completionGraceMs: input.completionGraceMs,
        });
        // message：从总结文本中抽取出的单行 commit message。
        const message = (0, gitCommitSummaryResult_1.extractCommitSummaryMessage)(rawText);
        if (!message)
            throw new Error("git commit summary message missing");
        // normalizedRawText：统一补齐“变更概要”段落，避免前端显示原始不稳定文本。
        const normalizedRawText = (0, gitCommitSummaryResult_1.buildNormalizedCommitSummaryText)({
            rawText,
            message,
            fallbackOverviewLines: buildFallbackOverviewLines(promptFiles),
        });
        return { threadId, message, rawText: normalizedRawText };
    }
    finally {
        await input.codex.archiveThread({ threadId }).catch(() => undefined);
    }
}
//# sourceMappingURL=gitCommitSummaryService.js.map