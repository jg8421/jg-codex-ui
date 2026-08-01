"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGitRoutes = createGitRoutes;
const express_1 = __importDefault(require("express"));
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_os_1 = __importDefault(require("node:os"));
const accessControl_1 = require("../../workspace/accessControl");
const gitCommand_1 = require("../gitCommand");
const gitDiff_1 = require("../gitDiff");
const gitConflictStages_1 = require("../gitConflictStages");
const gitMergePreview_1 = require("../gitMergePreview");
const gitSwitch_1 = require("../gitSwitch");
const gitStatusPorcelain_1 = require("../gitStatusPorcelain");
const gitAuthEnv_1 = require("../gitAuthEnv");
const gitRemoteUrl_1 = require("../gitRemoteUrl");
const gitRemoteOrigin_1 = require("../gitRemoteOrigin");
const gitUnstage_1 = require("../gitUnstage");
const gitRefFormat_1 = require("../gitRefFormat");
const gitRemoteName_1 = require("../gitRemoteName");
const gitRemoteConfig_1 = require("../gitRemoteConfig");
const gitLogQuery_1 = require("../gitLogQuery");
/**
 * 将用户输入的 cwd 解析为 canonicalCwd，并确保在当前用户授权范围内。
 */
async function resolveCanonicalCwdFromRequest(req, res, rawCwd) {
    // user：由上层 `/api` requireAuth 中间件注入。
    const user = req.user;
    if (!user) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return null;
    }
    // cwd：允许相对/绝对；相对路径以 CODEX_CWD 为基准（由 assertCwdAllowedForUser 负责解析）。
    const requestedCwd = typeof rawCwd === "string" ? rawCwd : "";
    if (!String(requestedCwd ?? "").trim()) {
        res.status(400).json({ ok: false, error: "invalid_request", details: "cwd is required" });
        return null;
    }
    try {
        const canonicalCwd = await (0, accessControl_1.assertCwdAllowedForUser)({
            cwd: requestedCwd,
            user: {
                role: user.role === "admin" ? "admin" : "member",
                workspaces: Array.isArray(user.workspaces) ? user.workspaces.map((w) => String(w ?? "")) : [],
            },
        });
        return canonicalCwd;
    }
    catch (err) {
        res.status(403).json({ ok: false, error: "path_not_allowed", details: String(err?.message ?? err ?? "") });
        return null;
    }
}
/**
 * 提取当前已鉴权用户的用户名；缺失时直接返回 401。
 */
function resolveAuthenticatedUsernameFromRequest(req, res) {
    const username = String(req.user?.username ?? "").trim();
    if (username)
        return username;
    res.status(401).json({ ok: false, error: "unauthorized" });
    return null;
}
/**
 * 规范化 Git 认证请求；缺失时回退为 auto。
 */
function normalizeGitAuthRequest(raw) {
    const record = raw && typeof raw === "object" ? raw : {};
    const modeRaw = String(record.mode ?? "").trim();
    const mode = modeRaw === "local" || modeRaw === "credential" ? modeRaw : "auto";
    const credentialId = String(record.credentialId ?? "").trim();
    if (mode === "credential") {
        return {
            mode,
            credentialId: credentialId || undefined,
        };
    }
    return { mode };
}
/**
 * 本机模式 Git 执行：不注入凭证，仅禁用交互式提示。
 */
async function runGitCommandLocalNonInteractive(input) {
    const out = await (0, gitCommand_1.runGitCommand)({
        cwd: input.cwd,
        args: input.args,
        timeoutMs: input.timeoutMs,
        env: { GIT_TERMINAL_PROMPT: "0" },
    });
    return {
        stdout: String(out.stdout ?? ""),
        stderr: String(out.stderr ?? ""),
        exitCode: Number.isFinite(out.exitCode) ? out.exitCode : 1,
    };
}
/**
 * 为“已知 remote URL”解析目标协议/主机，并尝试匹配用户保存的凭证。
 */
async function resolveMatchedCredentialForRemoteUrl(input) {
    const parsed = (0, gitRemoteUrl_1.parseGitRemoteUrl)(input.remoteUrl);
    const remoteTarget = parsed && parsed.host
        ? {
            host: parsed.host,
            protocol: parsed.protocol,
        }
        : null;
    if (input.auth.mode === "credential") {
        const requestedCredentialId = String(input.auth.credentialId ?? "").trim();
        if (!requestedCredentialId) {
            return { matchedCredential: null, credentialError: "credentialId is required", remoteTarget };
        }
        if (!remoteTarget) {
            return { matchedCredential: null, credentialError: "remote url is invalid", remoteTarget: null };
        }
        const credential = await input.credentialStore.getCredentialById({ username: input.username, credentialId: requestedCredentialId });
        if (!credential) {
            return { matchedCredential: null, credentialError: "git credential not found", remoteTarget };
        }
        if (credential.metadata.host !== remoteTarget.host || credential.metadata.protocol !== remoteTarget.protocol) {
            return { matchedCredential: null, credentialError: "git credential does not match remote url", remoteTarget };
        }
        return { matchedCredential: credential, credentialError: null, remoteTarget };
    }
    if (!remoteTarget) {
        return { matchedCredential: null, credentialError: null, remoteTarget: null };
    }
    const credential = await input.credentialStore.findCredentialForRemote({
        username: input.username,
        host: remoteTarget.host,
        protocol: remoteTarget.protocol,
    });
    return { matchedCredential: credential, credentialError: null, remoteTarget };
}
/**
 * 对“指定 remote URL”的 Git 命令执行可选凭证注入（用于 clone）。
 */
async function runGitCommandForRemoteWithOptionalCredential(input) {
    // local：不使用服务端保存的凭证，直接依赖本机 git helper/ssh agent。
    if (input.auth.mode === "local") {
        return runGitCommandLocalNonInteractive({ cwd: input.cwd, args: input.args, timeoutMs: input.timeoutMs });
    }
    // auto：凭证能力未启用时直接退回本机执行。
    if (!input.credentialStore) {
        if (input.auth.mode === "auto") {
            return runGitCommandLocalNonInteractive({ cwd: input.cwd, args: input.args, timeoutMs: input.timeoutMs });
        }
        return { stdout: "", stderr: "git credential storage is unavailable", exitCode: 1 };
    }
    const { matchedCredential, credentialError } = await resolveMatchedCredentialForRemoteUrl({
        username: input.username,
        remoteUrl: input.remoteUrl,
        auth: input.auth,
        credentialStore: input.credentialStore,
    });
    if (credentialError) {
        return { stdout: "", stderr: credentialError, exitCode: 1 };
    }
    // 未命中凭证：仍然允许执行（例如 public repo），但禁用交互式 prompt，避免卡住。
    if (!matchedCredential) {
        return runGitCommandLocalNonInteractive({ cwd: input.cwd, args: input.args, timeoutMs: input.timeoutMs });
    }
    const tmpDirPath = await promises_1.default.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), "codex-git-remote-auth-"));
    const cleanupPaths = [];
    try {
        const built = matchedCredential.secret.type === "https_pat"
            ? await (0, gitAuthEnv_1.buildHttpsGitAuthEnv)(tmpDirPath, matchedCredential.secret)
            : await (0, gitAuthEnv_1.buildSshGitAuthEnv)(tmpDirPath, matchedCredential.secret);
        cleanupPaths.push(...built.cleanupPaths);
        const out = await (0, gitCommand_1.runGitCommand)({
            cwd: input.cwd,
            args: input.args,
            timeoutMs: input.timeoutMs,
            env: built.env,
        });
        return {
            stdout: String(out.stdout ?? ""),
            stderr: String(out.stderr ?? ""),
            exitCode: Number.isFinite(out.exitCode) ? out.exitCode : 1,
        };
    }
    finally {
        for (const cleanupPath of cleanupPaths.reverse()) {
            await promises_1.default.rm(cleanupPath, { force: true });
        }
        await promises_1.default.rm(tmpDirPath, { recursive: true, force: true });
    }
}
/**
 * 判断当前实例是否启用了 Git 凭证能力。
 */
function ensureGitCredentialStoreEnabled(res, gitCredentialStore) {
    if (gitCredentialStore)
        return true;
    res.status(501).json({
        ok: false,
        error: "git_credentials_disabled",
        details: "Git credential storage is unavailable for this app instance.",
    });
    return false;
}
/**
 * 解析并限制 log/status 等查询的 limit，范围 [1, 200]。
 */
function parseLimit(rawLimit, fallback) {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed))
        return Math.min(200, Math.max(1, Math.floor(fallback)));
    return Math.min(200, Math.max(1, Math.floor(parsed)));
}
/**
 * 将用户输入的 pathspec 规范化为“相对路径”：
 * - 禁止绝对路径；
 * - 禁止 `..` 越界；
 * - 禁止 NUL。
 */
function normalizeRequestedPathspec(repoRoot, raw) {
    const candidate = typeof raw === "string" ? raw : "";
    const trimmed = candidate.trim();
    if (!trimmed)
        return null;
    if (trimmed.includes("\0"))
        return null;
    if (node_path_1.default.isAbsolute(trimmed))
        return null;
    // resolved：将 pathspec 视为 repoRoot 下路径，确保不越界。
    const resolved = node_path_1.default.resolve(repoRoot, trimmed);
    if (!(0, accessControl_1.isPathWithinRoot)(repoRoot, resolved))
        return null;
    // 返回“相对 repoRoot”的路径（保持用户看到的相对路径语义一致）。
    const rel = node_path_1.default.relative(repoRoot, resolved);
    return rel || null;
}
/**
 * 规范化并校验 `git show` 的 rev：
 * - 仅允许 7~40 位十六进制 hash（UI 点击提交时使用短/全 hash）；
 * - 禁止空白/NUL。
 */
function normalizeRequestedRev(raw) {
    const candidate = typeof raw === "string" ? raw : "";
    const trimmed = candidate.trim();
    if (!trimmed)
        return null;
    if (trimmed.includes("\0"))
        return null;
    if (/\s/.test(trimmed))
        return null;
    if (!/^[0-9a-fA-F]{7,40}$/.test(trimmed))
        return null;
    return trimmed;
}
/**
 * 规范化并校验 Git ref/branch 名称（用于 branches/switch）。
 *
 * 设计：
 * - 只接受“常见且安全”的 ref 形式，避免参数注入与复杂 rev 解析；
 * - 允许 `HEAD` 与 `origin/...` 这类常见远端引用。
 */
function normalizeRequestedGitRefName(raw) {
    const candidate = typeof raw === "string" ? raw : "";
    const trimmed = candidate.trim();
    if (!trimmed)
        return null;
    if (trimmed.includes("\0"))
        return null;
    if (/\s/.test(trimmed))
        return null;
    if (trimmed.startsWith("-"))
        return null;
    if (trimmed.length > 200)
        return null;
    if (trimmed === "HEAD")
        return trimmed;
    // 仅允许字母数字开头，后续允许常见分支字符（含 `/`）。
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(trimmed))
        return null;
    // 简单防御：避免 `..` 这种路径式跳转语义。
    if (trimmed.includes(".."))
        return null;
    return trimmed;
}
/**
 * 解析 `git rev-list --left-right --count @{upstream}...HEAD` 的结果为 behind/ahead。
 */
function parseAheadBehind(raw) {
    const text = String(raw ?? "").trim();
    const [behindRaw, aheadRaw] = text.split(/\s+/);
    const behind = Number(behindRaw);
    const ahead = Number(aheadRaw);
    return {
        behind: Number.isFinite(behind) ? Math.max(0, Math.floor(behind)) : 0,
        ahead: Number.isFinite(ahead) ? Math.max(0, Math.floor(ahead)) : 0,
    };
}
/**
 * 规范化 Pull 策略，默认使用 ff-only，避免非法值直接透传到 Git CLI。
 */
function normalizeGitPullMode(raw) {
    const mode = String(raw ?? "ff-only").trim();
    if (mode === "merge" || mode === "rebase")
        return mode;
    return "ff-only";
}
/**
 * 规范化 Git 凭证协议；未显式提供时根据凭证类型推导默认值。
 */
function normalizeGitCredentialProtocol(rawProtocol, rawType) {
    const protocol = String(rawProtocol ?? "").trim().toLowerCase();
    if (protocol === "https" || protocol === "ssh")
        return protocol;
    const credentialType = String(rawType ?? "").trim().toLowerCase();
    if (credentialType === "https_pat")
        return "https";
    if (credentialType === "ssh_key")
        return "ssh";
    return null;
}
/**
 * 规范化凭证文本输入。
 */
function normalizeGitCredentialTextField(rawValue) {
    return String(rawValue ?? "").trim();
}
/**
 * 将请求体映射为标准化的凭证创建输入。
 */
function buildCreateGitCredentialInput(ownerUsername, body) {
    const credentialType = normalizeGitCredentialTextField(body.type);
    const label = normalizeGitCredentialTextField(body.label);
    const host = normalizeGitCredentialTextField(body.host).toLowerCase();
    const credentialUsername = normalizeGitCredentialTextField(body.username);
    const protocol = normalizeGitCredentialProtocol(body.protocol, credentialType);
    if (!label || !host || !credentialUsername || !protocol)
        return null;
    if (credentialType === "https_pat") {
        const token = normalizeGitCredentialTextField(body.token);
        if (!token)
            return null;
        return {
            username: ownerUsername,
            label,
            host,
            protocol,
            credential: {
                type: "https_pat",
                username: credentialUsername,
                token,
            },
        };
    }
    if (credentialType === "ssh_key") {
        const privateKey = String(body.privateKey ?? "");
        const passphrase = normalizeGitCredentialTextField(body.passphrase);
        if (!privateKey.trim())
            return null;
        return {
            username: ownerUsername,
            label,
            host,
            protocol,
            credential: {
                type: "ssh_key",
                username: credentialUsername,
                privateKey,
                passphrase: passphrase || null,
            },
        };
    }
    return null;
}
/**
 * 规范化凭证路由参数中的 id。
 */
function normalizeCredentialRouteId(rawValue) {
    return String(rawValue ?? "").trim();
}
/**
 * 将请求体映射为标准化的凭证更新输入。
 */
function buildUpdateGitCredentialInput(ownerUsername, credentialId, body) {
    // createInput：更新接口与创建接口共享同一套字段校验。
    const createInput = buildCreateGitCredentialInput(ownerUsername, body);
    if (!createInput)
        return null;
    // normalizedCredentialId：待更新的目标凭证 id。
    const normalizedCredentialId = normalizeCredentialRouteId(credentialId);
    if (!normalizedCredentialId)
        return null;
    return {
        credentialId: normalizedCredentialId,
        ...createInput,
    };
}
/**
 * 根据 Pull 策略生成明确的 Git 参数：
 * - merge 显式使用 `--no-rebase`，避免依赖仓库本地配置；
 * - rebase / ff-only 同理全部显式化。
 */
function resolveGitPullArgs(mode) {
    if (mode === "rebase")
        return ["pull", "--rebase"];
    if (mode === "merge")
        return ["pull", "--no-rebase"];
    return ["pull", "--ff-only"];
}
/**
 * 将一次 Git 命令执行结果包装成前端可展示的阶段结构。
 */
function buildGitCommandPhase(title, result) {
    return {
        title,
        stdout: String(result.stdout ?? ""),
        stderr: String(result.stderr ?? ""),
        exitCode: Number.isFinite(result.exitCode) ? result.exitCode : 1,
    };
}
/**
 * 提取一次 Git 命令最适合返回给前端的简短失败详情。
 */
function resolveGitCommandDetails(result, fallback) {
    return String(result.stderr || result.stdout || fallback);
}
/**
 * 判断 `git push` 失败是否属于“远端已前进，需要先更新本地”的拒绝类型。
 */
function isPushRejectedForRemoteDrift(result) {
    const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();
    return (combined.includes("non-fast-forward") ||
        combined.includes("fetch first") ||
        combined.includes("failed to push some refs") ||
        combined.includes("remote contains work that you do not have locally"));
}
/**
 * 构造 `/api/git/push` 返回给前端的统一输出结构。
 */
function buildGitPushRouteOutput(input) {
    return {
        stdout: String(input.finalResult.stdout ?? ""),
        stderr: String(input.finalResult.stderr ?? ""),
        exitCode: Number.isFinite(input.finalResult.exitCode) ? input.finalResult.exitCode : 1,
        autoUpdateAttempted: input.autoUpdateAttempted,
        autoUpdated: input.autoUpdated,
        updateMode: input.updateMode,
        pushAttempts: input.pushAttempts,
        phases: input.phases,
    };
}
/**
 * 执行参考 IDEA 行为的智能 Push：
 * - 先尝试一次普通 push；
 * - 仅在非快进拒绝时才按当前 Pull 策略自动更新；
 * - 更新成功后重试 push，更新失败则原样返回失败阶段。
 */
async function executeSmartGitPush(repoRoot, username, mode, gitAuthenticatedCommandRunner, auth) {
    // runner：根据 auth 选择执行器；local 模式不注入 credentialId。
    const credentialId = auth.mode === "credential" ? String(auth.credentialId ?? "").trim() : "";
    const runner = auth.mode === "local"
        ? async (input) => (0, gitCommand_1.runGitCommand)({
            cwd: input.repoRoot,
            args: input.args,
            timeoutMs: input.timeoutMs,
            env: { GIT_TERMINAL_PROMPT: "0" },
        })
        : gitAuthenticatedCommandRunner;
    // firstPush：第一次 push，若成功则直接返回，不做额外 update。
    const firstPush = await runner({
        repoRoot,
        username,
        ...(credentialId ? { credentialId } : {}),
        args: ["push"],
        timeoutMs: 300_000,
    });
    const phases = [buildGitCommandPhase("git push", firstPush)];
    if (firstPush.exitCode === 0) {
        return {
            ok: true,
            statusCode: 200,
            output: buildGitPushRouteOutput({
                phases,
                finalResult: firstPush,
                autoUpdateAttempted: false,
                autoUpdated: false,
                pushAttempts: 1,
            }),
        };
    }
    if (!isPushRejectedForRemoteDrift(firstPush)) {
        return {
            ok: false,
            statusCode: 500,
            error: "request_failed",
            details: resolveGitCommandDetails(firstPush, "git push failed"),
            output: buildGitPushRouteOutput({
                phases,
                finalResult: firstPush,
                autoUpdateAttempted: false,
                autoUpdated: false,
                pushAttempts: 1,
            }),
        };
    }
    // update：仅在 push 被远端分叉拒绝时执行，行为与 IDEA 的 auto-update 更一致。
    const updateArgs = resolveGitPullArgs(mode);
    const updateTitle = mode === "rebase" ? "git pull --rebase" : mode === "merge" ? "git pull --no-rebase" : "git pull --ff-only";
    const update = await runner({
        repoRoot,
        username,
        ...(credentialId ? { credentialId } : {}),
        args: updateArgs,
        timeoutMs: 300_000,
    });
    phases.push(buildGitCommandPhase(updateTitle, update));
    if (update.exitCode !== 0) {
        return {
            ok: false,
            statusCode: 500,
            error: "update_failed",
            details: resolveGitCommandDetails(update, "git pull failed"),
            output: buildGitPushRouteOutput({
                phases,
                finalResult: update,
                autoUpdateAttempted: true,
                autoUpdated: false,
                updateMode: mode,
                pushAttempts: 1,
            }),
        };
    }
    // retryPush：update 成功后再次 push，保持用户仍然只点击一次 Push。
    const retryPush = await runner({
        repoRoot,
        username,
        ...(credentialId ? { credentialId } : {}),
        args: ["push"],
        timeoutMs: 300_000,
    });
    phases.push(buildGitCommandPhase("git push (retry)", retryPush));
    const ok = retryPush.exitCode === 0;
    return {
        ok,
        statusCode: ok ? 200 : 500,
        error: ok ? undefined : "request_failed",
        details: ok ? undefined : resolveGitCommandDetails(retryPush, "git push failed"),
        output: buildGitPushRouteOutput({
            phases,
            finalResult: retryPush,
            autoUpdateAttempted: true,
            autoUpdated: true,
            updateMode: mode,
            pushAttempts: 2,
        }),
    };
}
/**
 * 在当前 Git status 快照中按相对路径查找文件项。
 */
function findGitStatusFile(snapshot, pathspec) {
    for (const file of snapshot.files) {
        if (file.path === pathspec)
            return file;
    }
    return null;
}
/**
 * 判断 pathspec 当前是否已被 Git 跟踪：
 * - 已提交文件会返回 true；
 * - 已 `git add` 的新增文件同样会返回 true；
 * - 纯未跟踪文件返回 false。
 */
async function isGitTrackedPath(repoRoot, pathspec) {
    const tracked = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["ls-files", "--error-unmatch", "--", pathspec],
    });
    return tracked.exitCode === 0;
}
/**
 * 解析单文件 Git 动作（删除/回滚）所需的公共上下文。
 */
async function resolveGitFileActionContext(req, res, input) {
    // canonicalCwd：用户提交的工作目录，需先做授权与 canonical 解析。
    const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, input.cwd);
    if (!canonicalCwd)
        return null;
    // resolved：包含授权校验后的 repoRoot。
    const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
    if (!resolved)
        return null;
    // pathspec：限制为 repoRoot 内的相对路径。
    const pathspec = normalizeRequestedPathspec(resolved.repoRoot, input.path);
    if (!pathspec) {
        res.status(400).json({ ok: false, error: "invalid_request", details: "path is required" });
        return null;
    }
    // absPath：单文件操作最终作用到磁盘的绝对路径。
    const absPath = node_path_1.default.resolve(resolved.repoRoot, pathspec);
    if (!(0, accessControl_1.isPathWithinRoot)(resolved.repoRoot, absPath)) {
        res.status(403).json({ ok: false, error: "path_not_allowed" });
        return null;
    }
    // snapshot：用于判断该文件当前是否仍出现在 Git 变更列表中。
    const snapshot = await getGitStatusSnapshot(resolved.repoRoot);
    // file：若目标文件当前存在本地变更/未跟踪，则会出现在 status 列表里。
    const file = findGitStatusFile(snapshot, pathspec);
    // tracked：即使当前文件已经恢复为 clean，也可能仍是 Git 跟踪文件，因此单独判断。
    const tracked = await isGitTrackedPath(resolved.repoRoot, pathspec);
    return {
        repoRoot: resolved.repoRoot,
        pathspec,
        absPath,
        file,
        tracked,
    };
}
/**
 * 将异常序列化为可返回给前端的结构：
 * - details：始终返回可读的错误文本；
 * - stack：仅在非生产环境或 admin 账号下返回（便于定位线上 500）。
 */
function serializeGitRouteError(req, err) {
    const details = String(err);
    const stack = err instanceof Error ? String(err.stack ?? "") : "";
    const userRole = String(req?.user?.role ?? "").trim();
    const includeStack = process.env.NODE_ENV !== "production" || userRole === "admin";
    if (!includeStack || !stack)
        return { details };
    return { details, stack };
}
/**
 * 从线程 cwd 解析 repoRoot 并做“repoRoot 必须在授权范围内”的二次校验。
 */
async function resolveRepoRootForRequest(req, res, canonicalCwd) {
    // revParse：`git rev-parse --show-toplevel`；非 git repo 会返回非 0。
    const revParse = await (0, gitCommand_1.runGitCommand)({ cwd: canonicalCwd, args: ["rev-parse", "--show-toplevel"] });
    if (revParse.exitCode !== 0) {
        res.status(404).json({ ok: false, error: "not_git_repo", details: revParse.stderr || revParse.stdout || "not_git_repo" });
        return null;
    }
    const repoRootRaw = String(revParse.stdout ?? "").trim();
    if (!repoRootRaw) {
        res.status(404).json({ ok: false, error: "not_git_repo" });
        return null;
    }
    try {
        // user：由上层 `/api` requireAuth 中间件注入。
        const user = req.user;
        if (!user) {
            res.status(401).json({ ok: false, error: "unauthorized" });
            return null;
        }
        // canonicalRepoRoot：复用现有 access control，确保 repoRoot 本身也在授权 root 内。
        const canonicalRepoRoot = await (0, accessControl_1.assertCwdAllowedForUser)({
            cwd: repoRootRaw,
            user: {
                role: user.role === "admin" ? "admin" : "member",
                workspaces: Array.isArray(user.workspaces) ? user.workspaces.map((w) => String(w ?? "")) : [],
            },
        });
        return { cwd: canonicalCwd, repoRoot: canonicalRepoRoot };
    }
    catch (err) {
        res.status(403).json({ ok: false, error: "repo_root_not_allowed", details: String(err?.message ?? err ?? "") });
        return null;
    }
}
/**
 * 拉取 Git status（包含 branch 与 ahead/behind）。
 */
async function getGitStatusSnapshot(repoRoot) {
    // status：porcelain(-z) 更易解析；补充 `--untracked-files=all` 避免把未跟踪目录汇总为 `?? dir/`，
    // 否则 UI 会只显示目录占位而看不到目录内的具体文件。
    const status = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    });
    const files = status.exitCode === 0 ? (0, gitStatusPorcelain_1.parseGitStatusPorcelainZ)(status.stdout) : [];
    // branchName：当前分支（detached 时可能为 HEAD）。
    const branchNameRes = await (0, gitCommand_1.runGitCommand)({ cwd: repoRoot, args: ["rev-parse", "--abbrev-ref", "HEAD"] });
    const branchName = branchNameRes.exitCode === 0 ? String(branchNameRes.stdout ?? "").trim() : "HEAD";
    // upstream：无 upstream 时命令会失败；此时返回 undefined。
    const upstreamRes = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    });
    const upstream = upstreamRes.exitCode === 0 ? String(upstreamRes.stdout ?? "").trim() : "";
    // aheadBehind：无 upstream 时命令会失败；此时默认 0/0。
    const aheadBehindRes = await (0, gitCommand_1.runGitCommand)({
        cwd: repoRoot,
        args: ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
    });
    const aheadBehind = aheadBehindRes.exitCode === 0 ? parseAheadBehind(aheadBehindRes.stdout) : { behind: 0, ahead: 0 };
    const isClean = files.length === 0;
    return {
        repoRoot,
        branch: {
            name: branchName || "HEAD",
            upstream: upstream || undefined,
            behind: aheadBehind.behind,
            ahead: aheadBehind.ahead,
        },
        isClean,
        files,
    };
}
/**
 * 创建基于 cwd 的 Git HTTP 路由：
 * - GET `/status?cwd=...`
 * - GET `/branches?cwd=...`
 * - GET `/log?cwd=...&limit=...`
 * - POST `/commit` body: { cwd, message, files }
 * - POST `/switch` body: { cwd, action, ... }
 * - POST `/pull` body: { cwd, mode }
 * - POST `/push` body: { cwd }
 */
function createGitRoutes(options) {
    const router = express_1.default.Router();
    const gitCredentialStore = options.gitCredentialStore ?? null;
    const gitPushMetadataStore = options.gitPushMetadataStore ?? null;
    const gitAuthenticatedCommandRunner = options.gitAuthenticatedCommandRunner;
    router.get("/remote/origin", async (req, res) => {
        try {
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, req.query?.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            // originUrl：对已有仓库做防御式脱敏，避免历史遗留的 `https://user:token@...` 被直接返回给前端。
            const rawOriginUrl = await (0, gitRemoteOrigin_1.getOriginRemoteUrl)(resolved.repoRoot);
            const originUrl = rawOriginUrl ? (0, gitRemoteOrigin_1.sanitizeGitRemoteUrl)(rawOriginUrl).sanitizedUrl : null;
            const target = await (0, gitRemoteOrigin_1.getOriginRemoteTarget)(resolved.repoRoot);
            res.json({
                ok: true,
                originUrl,
                target,
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: remote/origin failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.post("/remote/origin", async (req, res) => {
        try {
            const body = (req.body ?? {});
            const requestedUrl = String(body.url ?? "").trim();
            if (!requestedUrl) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "url is required" });
                return;
            }
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, body.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const sanitized = (0, gitRemoteOrigin_1.sanitizeGitRemoteUrl)(requestedUrl);
            const urlToWrite = String(sanitized.sanitizedUrl ?? "").trim();
            if (!urlToWrite) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "invalid url" });
                return;
            }
            const existing = await (0, gitCommand_1.runGitCommand)({ cwd: resolved.repoRoot, args: ["remote", "get-url", "origin"] });
            const out = existing.exitCode === 0
                ? await (0, gitCommand_1.runGitCommand)({ cwd: resolved.repoRoot, args: ["remote", "set-url", "origin", urlToWrite] })
                : await (0, gitCommand_1.runGitCommand)({ cwd: resolved.repoRoot, args: ["remote", "add", "origin", urlToWrite] });
            const ok = out.exitCode === 0;
            res.status(ok ? 200 : 500).json({
                ok,
                output: { stdout: out.stdout, stderr: out.stderr, exitCode: out.exitCode },
                ...(ok ? {} : { error: "request_failed", details: out.stderr || out.stdout || "git remote failed" }),
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: remote/origin set failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.get("/remotes", async (req, res) => {
        try {
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, req.query?.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            // remotes：当前仓库已有的 remote 名列表。
            const remotes = await (0, gitRemoteConfig_1.listGitRemoteNames)(resolved.repoRoot);
            res.json({ ok: true, remotes });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: remotes list failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.get("/remote", async (req, res) => {
        try {
            // remoteName：从 query 读取并做保守校验。
            const remoteName = (0, gitRemoteName_1.normalizeRequestedGitRemoteName)(req.query?.name);
            if (!remoteName) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "name is required" });
                return;
            }
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, req.query?.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            // rawUrl：若 remote 不存在则为 null。
            const rawUrl = await (0, gitRemoteConfig_1.readGitRemoteUrl)(resolved.repoRoot, remoteName);
            // remoteUrl：对已有 URL 做防御式脱敏，避免回传 `https://user:token@...`。
            const remoteUrl = rawUrl ? (0, gitRemoteOrigin_1.sanitizeGitRemoteUrl)(rawUrl).sanitizedUrl : null;
            // target：解析 protocol/host/username；仅用于 UI 的“匹配凭证”提示，不影响写入。
            const target = remoteUrl ? (0, gitRemoteUrl_1.parseGitRemoteUrl)(remoteUrl) : null;
            // exists：remote 是否存在（以 get-url 成功为准）。
            const exists = Boolean(rawUrl);
            res.json({ ok: true, remoteUrl, target, exists });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: remote get failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.post("/remote", async (req, res) => {
        try {
            const body = (req.body ?? {});
            // remoteName：保守校验，避免 git 把 name 当成 option。
            const remoteName = (0, gitRemoteName_1.normalizeRequestedGitRemoteName)(body.name);
            if (!remoteName) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "invalid remote name" });
                return;
            }
            const requestedUrl = String(body.url ?? "").trim();
            if (!requestedUrl) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "url is required" });
                return;
            }
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, body.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const sanitized = (0, gitRemoteOrigin_1.sanitizeGitRemoteUrl)(requestedUrl);
            const urlToWrite = String(sanitized.sanitizedUrl ?? "").trim();
            if (!urlToWrite) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "invalid url" });
                return;
            }
            const out = await (0, gitRemoteConfig_1.writeGitRemoteUrl)(resolved.repoRoot, { remoteName, urlToWrite });
            const ok = out.exitCode === 0;
            res.status(ok ? 200 : 500).json({
                ok,
                output: { stdout: out.stdout, stderr: out.stderr, exitCode: out.exitCode },
                ...(ok ? {} : { error: "request_failed", details: out.stderr || out.stdout || "git remote failed" }),
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: remote set failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.post("/init", async (req, res) => {
        try {
            const body = (req.body ?? {});
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, body.cwd);
            if (!canonicalCwd)
                return;
            await promises_1.default.stat(canonicalCwd);
            // requestedInitialBranch：可选的初始分支名；用于 `git init -b <name>`。
            const requestedInitialBranch = String(body.initialBranch ?? "").trim();
            // initialBranch：规范化后的初始分支名（空字符串视为未指定）。
            const initialBranch = requestedInitialBranch ? requestedInitialBranch : null;
            // 校验 initialBranch：避免把明显非法的输入交给 git 再报错。
            if (initialBranch) {
                try {
                    await (0, gitRefFormat_1.assertValidBranchShortName)(canonicalCwd, initialBranch);
                }
                catch (err) {
                    // details：尽量透传 git stderr/stdout，便于前端提示。
                    const details = String(err?.message ?? err ?? "invalid_branch_name").trim() || "invalid_branch_name";
                    res.status(400).json({ ok: false, error: "invalid_request", details });
                    return;
                }
            }
            // env：禁止交互式提示，避免服务端 hang 住。
            const env = { GIT_TERMINAL_PROMPT: "0" };
            /**
             * 判断 git 是否不支持 `git init -b`（老版本 git）。
             */
            function isInitBranchFlagUnsupported(out) {
                // text：合并 stdout/stderr 后做小写匹配。
                const text = `${String(out.stderr ?? "")}\n${String(out.stdout ?? "")}`.toLowerCase();
                if (!text)
                    return false;
                // hasUnknown：出现“不认识参数/开关”的常见提示。
                const hasUnknown = text.includes("unknown option") ||
                    text.includes("unknown switch") ||
                    text.includes("unknown argument") ||
                    text.includes("unrecognized option");
                // mentionsB：错误信息里明确提到 -b 或 b 开关。
                const mentionsB = text.includes(" -b") || text.includes("`-b`") || text.includes("'-b'") || text.includes("switch `b`");
                return hasUnknown && mentionsB;
            }
            // fallbackUsed：是否因不支持 `-b` 而回退到 `git init`。
            let fallbackUsed = false;
            // out：最终采用的 git init 输出。
            const out = initialBranch
                ? await (async () => {
                    // initWithBranch：优先尝试带初始分支的初始化（新版本 git 支持）。
                    const initWithBranch = await (0, gitCommand_1.runGitCommand)({
                        cwd: canonicalCwd,
                        args: ["init", "-b", initialBranch],
                        timeoutMs: 120_000,
                        env,
                    });
                    if (initWithBranch.exitCode === 0)
                        return initWithBranch;
                    if (!isInitBranchFlagUnsupported(initWithBranch))
                        return initWithBranch;
                    // fallback：老版本 git 不支持 -b，回退到普通 init。
                    fallbackUsed = true;
                    const fallback = await (0, gitCommand_1.runGitCommand)({ cwd: canonicalCwd, args: ["init"], timeoutMs: 120_000, env });
                    return fallback;
                })()
                : await (0, gitCommand_1.runGitCommand)({ cwd: canonicalCwd, args: ["init"], timeoutMs: 120_000, env });
            const ok = out.exitCode === 0;
            res.status(ok ? 200 : 500).json({
                ok,
                output: {
                    stdout: out.stdout,
                    stderr: out.stderr,
                    exitCode: out.exitCode,
                    initialBranch,
                    fallbackUsed,
                },
                ...(ok ? {} : { error: "request_failed", details: out.stderr || out.stdout || "git init failed" }),
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: init failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.post("/clone", async (req, res) => {
        try {
            const username = resolveAuthenticatedUsernameFromRequest(req, res);
            if (!username)
                return;
            const body = (req.body ?? {});
            const requestedUrl = String(body.url ?? "").trim();
            if (!requestedUrl) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "url is required" });
                return;
            }
            const auth = normalizeGitAuthRequest(body.auth);
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, body.cwd);
            if (!canonicalCwd)
                return;
            await promises_1.default.stat(canonicalCwd);
            const entries = await promises_1.default.readdir(canonicalCwd).catch(() => []);
            if (entries.length) {
                res.status(409).json({ ok: false, error: "dir_not_empty", details: "target directory must be empty" });
                return;
            }
            const sanitized = (0, gitRemoteOrigin_1.sanitizeGitRemoteUrl)(requestedUrl);
            const urlToUse = String(sanitized.sanitizedUrl ?? "").trim();
            if (!urlToUse) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "invalid url" });
                return;
            }
            const cloneOut = await runGitCommandForRemoteWithOptionalCredential({
                cwd: canonicalCwd,
                username,
                remoteUrl: urlToUse,
                auth,
                args: ["clone", urlToUse, "."],
                timeoutMs: 300_000,
                credentialStore: gitCredentialStore,
            });
            const ok = cloneOut.exitCode === 0;
            res.status(ok ? 200 : 500).json({
                ok,
                output: cloneOut,
                ...(ok ? {} : { error: "request_failed", details: cloneOut.stderr || cloneOut.stdout || "git clone failed" }),
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: clone failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.get("/credentials", async (req, res) => {
        const username = resolveAuthenticatedUsernameFromRequest(req, res);
        if (!username)
            return;
        if (!ensureGitCredentialStoreEnabled(res, gitCredentialStore))
            return;
        try {
            const credentials = await gitCredentialStore.listCredentials(username);
            res.json({ ok: true, credentials });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: credentials list failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.post("/credentials", async (req, res) => {
        const username = resolveAuthenticatedUsernameFromRequest(req, res);
        if (!username)
            return;
        if (!ensureGitCredentialStoreEnabled(res, gitCredentialStore))
            return;
        try {
            const body = (req.body ?? {}) ?? {};
            const createInput = buildCreateGitCredentialInput(username, body);
            if (!createInput) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "invalid git credential payload" });
                return;
            }
            const credential = await gitCredentialStore.createCredential(createInput);
            res.json({ ok: true, credential });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: credentials create failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.put("/credentials/:id", async (req, res) => {
        const username = resolveAuthenticatedUsernameFromRequest(req, res);
        if (!username)
            return;
        if (!ensureGitCredentialStoreEnabled(res, gitCredentialStore))
            return;
        try {
            // body：待更新的凭证字段。
            const body = (req.body ?? {}) ?? {};
            // updateInput：标准化后的更新输入；缺字段时按 invalid_request 返回。
            const updateInput = buildUpdateGitCredentialInput(username, req.params?.id, body);
            if (!updateInput) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "invalid git credential payload" });
                return;
            }
            // credential：更新后的脱敏凭证；未命中记录时返回 404。
            const credential = await gitCredentialStore.updateCredential(updateInput);
            if (!credential) {
                res.status(404).json({ ok: false, error: "credential_not_found", details: "git credential not found" });
                return;
            }
            res.json({ ok: true, credential });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: credentials update failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.delete("/credentials/:id", async (req, res) => {
        const username = resolveAuthenticatedUsernameFromRequest(req, res);
        if (!username)
            return;
        if (!ensureGitCredentialStoreEnabled(res, gitCredentialStore))
            return;
        try {
            const credentialId = normalizeCredentialRouteId(req.params?.id);
            if (!credentialId) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "credential id is required" });
                return;
            }
            const deleted = await gitCredentialStore.deleteCredential(username, credentialId);
            if (!deleted) {
                res.status(404).json({ ok: false, error: "credential_not_found", details: "git credential not found" });
                return;
            }
            res.json({ ok: true });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: credentials delete failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.post("/credentials/test", async (req, res) => {
        const username = resolveAuthenticatedUsernameFromRequest(req, res);
        if (!username)
            return;
        if (!ensureGitCredentialStoreEnabled(res, gitCredentialStore))
            return;
        try {
            const body = (req.body ?? {});
            const credentialId = String(body.credentialId ?? "").trim();
            if (!credentialId) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "credentialId is required" });
                return;
            }
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, body.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const out = await gitAuthenticatedCommandRunner({
                repoRoot: resolved.repoRoot,
                username,
                credentialId,
                args: ["ls-remote", "--heads", "origin"],
                timeoutMs: 120_000,
            });
            const ok = out.exitCode === 0;
            res.status(ok ? 200 : 500).json({
                ok,
                output: {
                    stdout: out.stdout,
                    stderr: out.stderr,
                    exitCode: out.exitCode,
                },
                ...(ok ? {} : { error: "request_failed", details: out.stderr || out.stdout || "git ls-remote failed" }),
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: credentials test failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    /**
     * 获取单文件 diff：
     * - 支持未暂存/已暂存/auto；
     * - 支持 untracked（通过 `git diff --no-index /dev/null file`）。
     */
    router.get("/diff", async (req, res) => {
        try {
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, req.query?.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const pathspec = normalizeRequestedPathspec(resolved.repoRoot, req.query?.path);
            if (!pathspec) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "path is required" });
                return;
            }
            const rawMode = String((req.query?.mode ?? "auto")).trim();
            const mode = rawMode === "staged" || rawMode === "unstaged" || rawMode === "auto" ? rawMode : "auto";
            const out = await (0, gitDiff_1.getGitFileDiffText)({ repoRoot: resolved.repoRoot, pathspec, mode });
            res.json({ ok: true, diff: out.text, mode: out.resolvedMode });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: diff failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    /**
     * 获取某次提交的 patch 文本（用于“最近提交”列表点击查看）。
     */
    router.get("/show", async (req, res) => {
        try {
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, req.query?.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const rev = normalizeRequestedRev(req.query?.rev);
            if (!rev) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "rev is required" });
                return;
            }
            const show = await (0, gitCommand_1.runGitCommand)({
                cwd: resolved.repoRoot,
                args: ["show", "--no-color", "--pretty=medium", rev],
            });
            if (show.exitCode !== 0) {
                res.status(500).json({ ok: false, error: "request_failed", details: show.stderr || show.stdout || "git show failed" });
                return;
            }
            res.json({ ok: true, text: show.stdout });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: show failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.get("/status", async (req, res) => {
        try {
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, req.query?.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const snapshot = await getGitStatusSnapshot(resolved.repoRoot);
            res.json({ ok: true, status: snapshot });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: status failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    /**
     * 删除单个未跟踪文件：
     * - 仅允许删除当前 `git status` 中可见的 untracked 项；
     * - 已跟踪文件必须走“回滚”，避免误删。
     */
    router.post("/file/delete", async (req, res) => {
        try {
            const body = (req.body ?? {});
            const context = await resolveGitFileActionContext(req, res, { cwd: body.cwd, path: body.path });
            if (!context)
                return;
            if (!context.file?.untracked) {
                const error = context.tracked ? "file_not_untracked" : "file_not_found";
                const details = context.tracked ? "仅允许删除未跟踪文件；已跟踪文件请使用回滚。" : "目标文件当前不在未跟踪列表中。";
                res.status(context.tracked ? 409 : 404).json({ ok: false, error, details });
                return;
            }
            await promises_1.default.rm(context.absPath, { recursive: true, force: true });
            res.json({
                ok: true,
                output: {
                    stdout: `Removed ${context.pathspec}\n`,
                    stderr: "",
                    exitCode: 0,
                },
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: file/delete failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    /**
     * 回滚单个已跟踪文件到 HEAD：
     * - 撤销工作区与暂存区中的本地修改；
     * - 未跟踪文件不允许通过该接口处理。
     */
    router.post("/file/restore", async (req, res) => {
        try {
            const body = (req.body ?? {});
            const context = await resolveGitFileActionContext(req, res, { cwd: body.cwd, path: body.path });
            if (!context)
                return;
            if (context.file?.untracked || !context.tracked) {
                res.status(409).json({ ok: false, error: "file_not_tracked", details: "仅允许回滚已跟踪文件；未跟踪文件请直接删除。" });
                return;
            }
            if (context.file?.conflicted) {
                res.status(409).json({ ok: false, error: "file_conflicted", details: "冲突文件请使用冲突处理工具，不支持直接回滚。" });
                return;
            }
            const restore = await (0, gitCommand_1.runGitCommand)({
                cwd: context.repoRoot,
                args: ["restore", "--source=HEAD", "--staged", "--worktree", "--", context.pathspec],
            });
            if (restore.exitCode !== 0) {
                res.status(500).json({ ok: false, error: "request_failed", details: restore.stderr || restore.stdout || "git restore failed" });
                return;
            }
            res.json({
                ok: true,
                output: {
                    stdout: restore.stdout,
                    stderr: restore.stderr,
                    exitCode: restore.exitCode,
                },
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: file/restore failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    /**
     * 取消暂存（unstage）：
     * - 不传 `paths`：清空当前仓库所有已暂存内容；
     * - 传 `paths`：仅取消这些路径的暂存（限制为 status 中已暂存文件，避免误操作）。
     *
     * 说明：
     * - 仅影响暂存区（index），不会回滚工作区改动；
     * - 用于配合“选择提交”，快速清理 staged 内容，解除服务端 staged guard。
     */
    router.post("/unstage", async (req, res) => {
        try {
            const body = (req.body ?? {});
            // cwd：要执行 Git 操作的工作目录（可为 repo 内子目录）。
            const cwd = body.cwd;
            // rawPaths：可选路径列表；为空表示“取消全部暂存”。
            const rawPaths = Array.isArray(body.paths) ? body.paths : [];
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            // normalizedPaths：用户指定 paths 时，做规范化、去重，并限制为 staged 文件集合。
            let normalizedPaths;
            if (rawPaths.length) {
                const snapshot = await getGitStatusSnapshot(resolved.repoRoot);
                const stagedPaths = new Set(snapshot.files.filter((file) => file.staged).map((file) => file.path));
                const seen = new Set();
                const selected = [];
                for (const raw of rawPaths) {
                    const normalized = normalizeRequestedPathspec(resolved.repoRoot, raw);
                    if (!normalized)
                        continue;
                    if (!stagedPaths.has(normalized))
                        continue;
                    if (seen.has(normalized))
                        continue;
                    seen.add(normalized);
                    selected.push(normalized);
                }
                if (!selected.length) {
                    res.status(400).json({ ok: false, error: "invalid_request", details: "no valid staged paths selected" });
                    return;
                }
                normalizedPaths = selected;
            }
            const out = await (0, gitUnstage_1.unstageGitPaths)(resolved.repoRoot, { paths: normalizedPaths });
            if (out.exitCode !== 0) {
                res.status(500).json({ ok: false, error: "request_failed", details: out.stderr || out.stdout || "git unstage failed" });
                return;
            }
            res.json({
                ok: true,
                output: {
                    stdout: out.stdout,
                    stderr: out.stderr,
                    exitCode: out.exitCode,
                },
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: unstage failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    /**
     * 获取本地与远端分支列表：
     * - 返回 current 分支名（HEAD detached 时返回 "HEAD"）；
     * - 返回 branches 列表（含 refs/heads 与 refs/remotes），过滤 `origin/HEAD`。
     */
    router.get("/branches", async (req, res) => {
        try {
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, req.query?.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const currentBranchRes = await (0, gitCommand_1.runGitCommand)({ cwd: resolved.repoRoot, args: ["rev-parse", "--abbrev-ref", "HEAD"] });
            const current = currentBranchRes.exitCode === 0 ? String(currentBranchRes.stdout ?? "").trim() : "HEAD";
            // format：使用 \t 分隔字段（for-each-ref 不支持 `%xNN` 这类转义）。
            // short ref name：例如 main / origin/main。
            const format = "%(refname:short)\t%(refname)";
            const refsRes = await (0, gitCommand_1.runGitCommand)({
                cwd: resolved.repoRoot,
                args: ["for-each-ref", `--format=${format}`, "refs/heads", "refs/remotes"],
            });
            if (refsRes.exitCode !== 0) {
                res.status(500).json({ ok: false, error: "request_failed", details: refsRes.stderr || refsRes.stdout || "git for-each-ref failed" });
                return;
            }
            const branches = [];
            const lines = String(refsRes.stdout ?? "")
                .split("\n")
                .map((line) => line.trimEnd())
                .filter(Boolean);
            for (const line of lines) {
                const [shortName, fullRef] = line.split("\t");
                const name = String(shortName ?? "").trim();
                const ref = String(fullRef ?? "").trim();
                if (!name)
                    continue;
                if (name === "origin/HEAD")
                    continue;
                const kind = ref.startsWith("refs/remotes/") ? "remote" : "local";
                branches.push({ name, kind });
            }
            res.json({ ok: true, branches: { current: current || "HEAD", branches } });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: branches failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    /**
     * 切换/创建分支：
     * - action=switch: 切换到现有本地分支（git switch <target>）
     * - action=create: 基于 baseRef 创建并切换到新分支（git switch -c <newBranch> <baseRef>）
     * - trackUpstream: 可选，为新分支设置 upstream（git branch --set-upstream-to=<baseRef> <newBranch>）
     */
    router.post("/switch", async (req, res) => {
        const body = (req.body ?? {});
        const cwd = body.cwd;
        const action = String(body.action ?? "").trim();
        try {
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            if (action === "switch") {
                const target = normalizeRequestedGitRefName(body.target);
                if (!target) {
                    res.status(400).json({ ok: false, error: "invalid_request", details: "target is required" });
                    return;
                }
                const out = await (0, gitSwitch_1.switchToGitBranch)(resolved.repoRoot, target);
                if (out.exitCode !== 0) {
                    res.status(500).json({ ok: false, error: "request_failed", details: out.stderr || out.stdout || "git switch failed" });
                    return;
                }
                res.json({ ok: true, output: { stdout: out.stdout, stderr: out.stderr, exitCode: out.exitCode } });
                return;
            }
            if (action === "create") {
                const newBranch = normalizeRequestedGitRefName(body.newBranch);
                const baseRef = normalizeRequestedGitRefName(body.baseRef);
                const trackUpstream = body.trackUpstream === true;
                if (!newBranch) {
                    res.status(400).json({ ok: false, error: "invalid_request", details: "newBranch is required" });
                    return;
                }
                if (!baseRef) {
                    res.status(400).json({ ok: false, error: "invalid_request", details: "baseRef is required" });
                    return;
                }
                const out = await (0, gitSwitch_1.createAndSwitchGitBranch)(resolved.repoRoot, { newBranch, baseRef, trackUpstream });
                if (out.exitCode !== 0) {
                    res.status(500).json({ ok: false, error: "request_failed", details: out.stderr || out.stdout || "git switch -c failed" });
                    return;
                }
                res.json({ ok: true, output: { stdout: out.stdout, stderr: out.stderr, exitCode: out.exitCode } });
                return;
            }
            res.status(400).json({ ok: false, error: "invalid_request", details: "action must be switch|create" });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: switch failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.get("/log", async (req, res) => {
        try {
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, req.query?.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const limit = parseLimit(req.query?.limit, 50);
            const { items } = await (0, gitLogQuery_1.queryGitLogItems)({
                repoRoot: resolved.repoRoot,
                limit,
                pushMetadataStore: gitPushMetadataStore,
            });
            res.json({ ok: true, items });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: log failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.post("/commit", async (req, res) => {
        const body = (req.body ?? {});
        // cwd：要执行 Git 操作的工作目录（可为 repo 内子目录）。
        const cwd = body.cwd;
        // message：提交信息（必填）。
        const message = String(body.message ?? "").trim();
        // requestedFiles：用户勾选的文件列表（相对路径）。
        const requestedFiles = Array.isArray(body.files) ? body.files : [];
        if (!message) {
            res.status(400).json({ ok: false, error: "invalid_request", details: "commit message is required" });
            return;
        }
        if (!requestedFiles.length) {
            res.status(400).json({ ok: false, error: "invalid_request", details: "files is required" });
            return;
        }
        try {
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            // staged：为避免“选择提交”误包含已暂存内容，若存在 staged 则拒绝并提示用户先清理。
            const staged = await (0, gitCommand_1.runGitCommand)({ cwd: resolved.repoRoot, args: ["diff", "--cached", "--name-only", "-z"] });
            const hasStaged = staged.exitCode === 0 && Boolean(String(staged.stdout ?? ""));
            if (hasStaged) {
                res.status(409).json({ ok: false, error: "staged_changes_present", details: "存在已暂存内容，请先提交或取消暂存后再使用选择提交。" });
                return;
            }
            // snapshot：用于限制可提交文件集合（只允许提交当前 status 列表出现的路径）。
            const snapshot = await getGitStatusSnapshot(resolved.repoRoot);
            const allowedPaths = new Set(snapshot.files.map((f) => f.path));
            // normalizedFiles：规范化并去重后的 pathspec 列表。
            const normalizedFiles = [];
            const seen = new Set();
            for (const raw of requestedFiles) {
                const normalized = normalizeRequestedPathspec(resolved.repoRoot, raw);
                if (!normalized)
                    continue;
                if (!allowedPaths.has(normalized))
                    continue;
                if (seen.has(normalized))
                    continue;
                seen.add(normalized);
                normalizedFiles.push(normalized);
            }
            if (!normalizedFiles.length) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "no valid files selected" });
                return;
            }
            // add：对选中文件执行 `git add -A -- <paths...>`，包含新增/删除/修改。
            const add = await (0, gitCommand_1.runGitCommand)({ cwd: resolved.repoRoot, args: ["add", "-A", "--", ...normalizedFiles] });
            if (add.exitCode !== 0) {
                res.status(500).json({ ok: false, error: "request_failed", details: add.stderr || add.stdout || "git add failed" });
                return;
            }
            // commit：执行提交；若 hooks 阻止会返回非 0，前端可展示 stderr。
            const commit = await (0, gitCommand_1.runGitCommand)({ cwd: resolved.repoRoot, args: ["commit", "-m", message], timeoutMs: 120_000 });
            if (commit.exitCode !== 0) {
                res.status(500).json({ ok: false, error: "request_failed", details: commit.stderr || commit.stdout || "git commit failed" });
                return;
            }
            // head：返回新的 commit hash，便于 UI 更新。
            const head = await (0, gitCommand_1.runGitCommand)({ cwd: resolved.repoRoot, args: ["rev-parse", "HEAD"] });
            const hash = head.exitCode === 0 ? String(head.stdout ?? "").trim() : "";
            res.json({
                ok: true,
                output: {
                    stdout: commit.stdout,
                    stderr: commit.stderr,
                    hash: hash || undefined,
                },
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: commit failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.post("/pull", async (req, res) => {
        const body = (req.body ?? {});
        // cwd：要执行 Git 操作的工作目录（可为 repo 内子目录）。
        const cwd = body.cwd;
        // mode：拉取策略（ff-only/merge/rebase）。
        const mode = normalizeGitPullMode(body.mode);
        // auth：认证策略（自动/随本机/指定凭证）。
        const auth = normalizeGitAuthRequest(body.auth);
        const pullArgs = resolveGitPullArgs(mode);
        try {
            const username = resolveAuthenticatedUsernameFromRequest(req, res);
            if (!username)
                return;
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const credentialId = auth.mode === "credential" ? String(auth.credentialId ?? "").trim() : "";
            const pull = auth.mode === "local"
                ? await runGitCommandLocalNonInteractive({ cwd: resolved.repoRoot, args: pullArgs, timeoutMs: 300_000 })
                : await gitAuthenticatedCommandRunner({
                    repoRoot: resolved.repoRoot,
                    username,
                    ...(credentialId ? { credentialId } : {}),
                    args: pullArgs,
                    timeoutMs: 300_000,
                });
            const ok = pull.exitCode === 0;
            res.status(ok ? 200 : 500).json({
                ok,
                output: {
                    stdout: pull.stdout,
                    stderr: pull.stderr,
                    exitCode: pull.exitCode,
                },
                ...(ok ? {} : { error: "request_failed", details: pull.stderr || pull.stdout || "git pull failed" }),
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: pull failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    /**
     * 获取单个冲突文件的三方内容与可解析的冲突分段（diff3 markers）。
     */
    router.get("/conflicts/file", async (req, res) => {
        try {
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, req.query?.cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const pathspec = normalizeRequestedPathspec(resolved.repoRoot, req.query?.path);
            if (!pathspec) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "path is required" });
                return;
            }
            const triplet = await (0, gitConflictStages_1.getGitConflictStageTriplet)({ repoRoot: resolved.repoRoot, pathspec });
            const previewText = await (0, gitMergePreview_1.buildGitMergePreviewText)({
                repoRoot: resolved.repoRoot,
                base: triplet.base,
                ours: triplet.ours,
                theirs: triplet.theirs,
            });
            const segments = (0, gitMergePreview_1.parseDiff3ConflictMarkers)(previewText);
            res.json({
                ok: true,
                file: {
                    path: pathspec,
                    base: triplet.base,
                    ours: triplet.ours,
                    theirs: triplet.theirs,
                    segments,
                },
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: conflicts/file failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    /**
     * 冲突一键策略：整文件采用 ours/theirs，可选立即 `git add` 标记已解决。
     */
    router.post("/conflicts/checkout", async (req, res) => {
        try {
            const body = (req.body ?? {});
            const cwd = body.cwd;
            const rawPath = body.path;
            const sideRaw = String(body.side ?? "").trim();
            const stageAfter = Boolean(body.stageAfter);
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const pathspec = normalizeRequestedPathspec(resolved.repoRoot, rawPath);
            if (!pathspec) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "path is required" });
                return;
            }
            const sideArg = sideRaw === "theirs" ? "--theirs" : sideRaw === "ours" ? "--ours" : "";
            if (!sideArg) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "side must be ours/theirs" });
                return;
            }
            const checkout = await (0, gitCommand_1.runGitCommand)({ cwd: resolved.repoRoot, args: ["checkout", sideArg, "--", pathspec] });
            if (checkout.exitCode !== 0) {
                res.status(500).json({ ok: false, error: "request_failed", details: checkout.stderr || checkout.stdout || "git checkout failed" });
                return;
            }
            let addOut = null;
            if (stageAfter) {
                addOut = await (0, gitCommand_1.runGitCommand)({ cwd: resolved.repoRoot, args: ["add", "--", pathspec] });
                if (addOut.exitCode !== 0) {
                    res.status(500).json({ ok: false, error: "request_failed", details: addOut.stderr || addOut.stdout || "git add failed" });
                    return;
                }
            }
            res.json({
                ok: true,
                output: {
                    stdout: `${checkout.stdout || ""}${addOut?.stdout || ""}`,
                    stderr: `${checkout.stderr || ""}${addOut?.stderr || ""}`,
                    exitCode: 0,
                },
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: conflicts/checkout failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    /**
     * 应用合并结果文本到工作区文件，可选 `git add` 标记已解决。
     */
    router.post("/conflicts/apply", async (req, res) => {
        try {
            const body = (req.body ?? {});
            const cwd = body.cwd;
            const rawPath = body.path;
            const content = String(body.content ?? "");
            const stageAfter = Boolean(body.stageAfter);
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            const pathspec = normalizeRequestedPathspec(resolved.repoRoot, rawPath);
            if (!pathspec) {
                res.status(400).json({ ok: false, error: "invalid_request", details: "path is required" });
                return;
            }
            // absPath：目标文件绝对路径；再次做一次 root 校验，避免路径绕过。
            const absPath = node_path_1.default.resolve(resolved.repoRoot, pathspec);
            if (!(0, accessControl_1.isPathWithinRoot)(resolved.repoRoot, absPath)) {
                res.status(403).json({ ok: false, error: "path_not_allowed" });
                return;
            }
            // 确保父目录存在（防止冲突文件在新目录下）。
            await promises_1.default.mkdir(node_path_1.default.dirname(absPath), { recursive: true });
            await promises_1.default.writeFile(absPath, content, "utf8");
            let addOut = null;
            if (stageAfter) {
                addOut = await (0, gitCommand_1.runGitCommand)({ cwd: resolved.repoRoot, args: ["add", "--", pathspec] });
                if (addOut.exitCode !== 0) {
                    res.status(500).json({ ok: false, error: "request_failed", details: addOut.stderr || addOut.stdout || "git add failed" });
                    return;
                }
            }
            res.json({
                ok: true,
                output: {
                    stdout: String(addOut?.stdout ?? ""),
                    stderr: String(addOut?.stderr ?? ""),
                    exitCode: 0,
                },
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: conflicts/apply failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    router.post("/push", async (req, res) => {
        try {
            const body = (req.body ?? {});
            // cwd：要执行 Git 操作的工作目录（可为 repo 内子目录）。
            const cwd = body.cwd;
            // mode：Push 被拒后自动更新当前分支所使用的 Pull 策略。
            const mode = normalizeGitPullMode(body.mode);
            // auth：认证策略（自动/随本机/指定凭证）。
            const auth = normalizeGitAuthRequest(body.auth);
            const username = resolveAuthenticatedUsernameFromRequest(req, res);
            if (!username)
                return;
            const canonicalCwd = await resolveCanonicalCwdFromRequest(req, res, cwd);
            if (!canonicalCwd)
                return;
            const resolved = await resolveRepoRootForRequest(req, res, canonicalCwd);
            if (!resolved)
                return;
            // branchName：push 记录按当前分支维度保存，先在真正 push 前取值。
            const branchName = await (0, gitLogQuery_1.resolveCurrentGitBranchName)(resolved.repoRoot);
            // upstreamRef：用于计算“当前还有哪些 commit 尚未推送”。
            const upstreamRef = await (0, gitLogQuery_1.resolveCurrentGitUpstreamRef)(resolved.repoRoot);
            // unpushedCommitHashes：push 前领先于 upstream 的 commit 集合。
            const unpushedCommitHashes = await (0, gitLogQuery_1.listUnpushedCommitHashes)({
                repoRoot: resolved.repoRoot,
                upstreamRef,
            });
            const pushResult = await executeSmartGitPush(resolved.repoRoot, username, mode, gitAuthenticatedCommandRunner, auth);
            if (pushResult.ok && gitPushMetadataStore) {
                // pushedAt：以服务端确认 push 成功的时刻作为 pushedAt。
                const pushedAt = new Date().toISOString();
                // commitHashesToPersist：默认记录 push 前尚未推送的 commit；自动 merge 场景再补当前 HEAD。
                const commitHashesToPersist = [...unpushedCommitHashes];
                if (unpushedCommitHashes.length || pushResult.output.autoUpdated) {
                    const headHash = await (0, gitLogQuery_1.resolveCurrentGitHeadHash)(resolved.repoRoot);
                    if (headHash && !commitHashesToPersist.includes(headHash)) {
                        commitHashesToPersist.push(headHash);
                    }
                }
                await gitPushMetadataStore.upsertPushedCommits({
                    repoRoot: resolved.repoRoot,
                    branchName,
                    commitHashes: commitHashesToPersist,
                    pushedAt,
                });
            }
            res.status(pushResult.statusCode).json({
                ok: pushResult.ok,
                output: pushResult.output,
                ...(pushResult.ok ? {} : { error: pushResult.error, details: pushResult.details }),
            });
        }
        catch (err) {
            const serialized = serializeGitRouteError(req, err);
            // eslint-disable-next-line no-console
            console.error("git routes: push failed", { details: serialized.details, stack: serialized.stack });
            res.status(500).json({ ok: false, error: "request_failed", ...serialized });
        }
    });
    return router;
}
//# sourceMappingURL=gitRoutes.js.map