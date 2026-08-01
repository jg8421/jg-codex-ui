"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatProjector = void 0;
const attachmentPathRedaction_1 = require("./attachmentPathRedaction");
const chatItemEnricher_1 = require("./chatItemEnricher");
const fileChangeExtractor_1 = require("./fileChangeExtractor");
const skillCallMarker_1 = require("./skillCallMarker");
const contextUsageProjector_1 = require("./contextUsageProjector");
const todoPlanProjector_1 = require("./todoPlanProjector");
/**
 * 后端“聊天投影器”：
 * - 接收 Codex notification（method/params）；
 * - 产出 UI 可直接消费的 ChatOp（前端只需合并与渲染）；
 * - 并可选解析 TODO/上下文使用率等轻量附属状态。
 *
 * 说明：该投影器只支持 app-server v2 的 item/turn 生命周期事件；
 * 不再兼容 legacy `codex/event/*`（按你的要求移除旧版本兼容）。
 */
class ChatProjector {
    /**
     * 递增计数器：用于生成 best-effort 的 fallback id。
     */
    fallbackSeq = 0;
    /**
     * 投影单条 Codex notification。
     */
    projectNotification(input) {
        const normalizedThreadId = typeof input.threadId === "string" ? input.threadId.trim() : "";
        if (!normalizedThreadId) {
            return {
                ops: [],
                todoUpdate: null,
                usagePercent: null,
            };
        }
        const nowMs = Number.isFinite(input.nowMs) ? Math.max(0, Math.floor(input.nowMs)) : Date.now();
        const payload = input.payload;
        const method = typeof payload?.method === "string" ? payload.method : "";
        const params = payload?.params;
        const todoUpdate = (0, todoPlanProjector_1.extractTodoPlanUpdateFromCodexPayload)(input.payload);
        const usagePercent = (0, contextUsageProjector_1.extractContextUsagePercentFromPayload)(input.payload);
        const ops = projectCodexEventToChatOps({
            method,
            params,
            nowMs,
            resolveFallbackId: (prefix) => this.resolveFallbackId(prefix),
        });
        return {
            ops,
            todoUpdate,
            usagePercent,
        };
    }
    /**
     * 生成 best-effort fallback id：用于 itemId 缺失等非理想输入。
     */
    resolveFallbackId(prefix) {
        this.fallbackSeq += 1;
        const normalizedPrefix = String(prefix ?? "").trim().replace(/[^a-zA-Z0-9._:-]/g, "_");
        return `${normalizedPrefix || "x"}-${Date.now()}-${this.fallbackSeq}`;
    }
}
exports.ChatProjector = ChatProjector;
/**
 * 将完整文件变更收敛为“摘要模式”：
 * - 保留 path/kind 供 UI 展示文件列表；
 * - 清空 diff 正文，避免在聊天实时流里下发大体积 patch。
 */
function toDiffSummaryChanges(changes) {
    return changes.map((change) => ({
        path: change.path,
        kind: change.kind,
        diff: "",
        addedLines: Number.isFinite(change.addedLines) ? Math.max(0, Math.floor(Number(change.addedLines))) : 0,
        deletedLines: Number.isFinite(change.deletedLines) ? Math.max(0, Math.floor(Number(change.deletedLines))) : 0,
    }));
}
/**
 * 将单条 codex 通知投影为 ChatOps（增量操作）。
 */
function projectCodexEventToChatOps(input) {
    const ops = [];
    const method = String(input.method ?? "");
    const params = input.params;
    const nowMs = input.nowMs;
    /**
     * v2 item 生命周期事件：唯一实时来源。
     */
    if (method === "item/started") {
        const item = params?.item;
        const itemId = typeof item?.id === "string" ? item.id : "";
        const itemType = typeof item?.type === "string" ? item.type : "";
        const turnId = String(params?.turnId ?? "").trim();
        const safeTurnId = turnId || `t-${nowMs}`;
        if (itemType === "userMessage") {
            const parts = Array.isArray(item?.content) ? item.content : [];
            const message = parts
                .map((p) => (typeof p?.text === "string" ? p.text : ""))
                .filter(Boolean)
                .join("")
                .trim();
            if (!message)
                return ops;
            const displayMessage = (0, attachmentPathRedaction_1.redactAttachmentPathsForDisplay)(message);
            const safeItemId = itemId || input.resolveFallbackId("um");
            ops.push({
                op: "upsert",
                item: (0, chatItemEnricher_1.enrichChatItemForUi)({
                    id: `v2:um-${safeTurnId}:${safeItemId}`,
                    ts: nowMs,
                    role: "user",
                    text: displayMessage,
                    deliveryStatus: "sent",
                }),
            });
            return ops;
        }
        if (itemType === "commandExecution") {
            const command = String(item?.command ?? "").trim();
            if (!command)
                return ops;
            const header = formatCommandTranscript(stripBashLcAndEscape(command));
            const skillCallMarker = (0, skillCallMarker_1.extractSkillCallMarkerFromCommandExecutionItem)(item);
            const safeItemId = itemId || input.resolveFallbackId("cmd");
            ops.push({
                op: "upsert",
                item: (0, chatItemEnricher_1.enrichChatItemForUi)({
                    id: `v2:cmd-${safeTurnId}:${safeItemId}`,
                    ts: nowMs,
                    role: "system",
                    text: header,
                    streaming: true,
                    render: "terminal",
                    skillCallMarker,
                }),
            });
            return ops;
        }
        {
            // 容错：部分 app-server 会使用不同的 item.type 命名。
            const normalizedType = itemType.trim().toLowerCase();
            const changes = (0, fileChangeExtractor_1.extractFileChangesFromAny)(item);
            const looksLikeFileChange = normalizedType === "filechange" ||
                normalizedType === "file_change" ||
                normalizedType.includes("file") ||
                normalizedType.includes("patch");
            if (looksLikeFileChange && changes.length) {
                const safeItemId = itemId || input.resolveFallbackId("fc");
                const title = "文件变更";
                const summaryChanges = toDiffSummaryChanges(changes);
                ops.push({
                    op: "upsert",
                    item: (0, chatItemEnricher_1.enrichChatItemForUi)({
                        id: `v2:fc-${safeTurnId}:${safeItemId}`,
                        ts: nowMs,
                        role: "system",
                        text: title,
                        streaming: true,
                        render: "diff",
                        diff: { title, changes: summaryChanges },
                    }),
                });
            }
            return ops;
        }
    }
    if (method === "item/agentMessage/delta") {
        const itemId = String(params?.itemId ?? "").trim();
        const turnId = String(params?.turnId ?? "").trim();
        const safeTurnId = turnId || `t-${nowMs}`;
        const delta = String(params?.delta ?? "");
        if (!itemId || !delta)
            return ops;
        ops.push({ op: "text_delta", id: `v2:am-${safeTurnId}:${itemId}`, ts: nowMs, role: "assistant", delta });
        return ops;
    }
    if (method === "item/plan/delta") {
        const itemId = String(params?.itemId ?? "").trim();
        const turnId = String(params?.turnId ?? "").trim();
        const safeTurnId = turnId || `t-${nowMs}`;
        const delta = String(params?.delta ?? "");
        if (!itemId || !delta)
            return ops;
        ops.push({ op: "text_delta", id: `v2:plan-${safeTurnId}:${itemId}`, ts: nowMs, role: "assistant", delta });
        return ops;
    }
    if (method === "item/reasoning/summaryTextDelta") {
        const itemId = String(params?.itemId ?? "").trim();
        const turnId = String(params?.turnId ?? "").trim();
        const safeTurnId = turnId || `t-${nowMs}`;
        const summaryIndex = Number(params?.summaryIndex ?? 0);
        const delta = String(params?.delta ?? "");
        if (!itemId || !delta)
            return ops;
        ops.push({
            op: "text_delta",
            id: `v2:rs-${safeTurnId}:${itemId}:${Number.isFinite(summaryIndex) ? summaryIndex : 0}`,
            ts: nowMs,
            role: "reasoning",
            delta,
        });
        return ops;
    }
    if (method === "item/reasoning/textDelta") {
        // reasoning 完整内容不用于 UI 渲染（仅展示 summary）。
        return ops;
    }
    if (method === "item/commandExecution/outputDelta") {
        const itemId = String(params?.itemId ?? "").trim();
        const turnId = String(params?.turnId ?? "").trim();
        const safeTurnId = turnId || `t-${nowMs}`;
        const delta = String(params?.delta ?? "");
        if (!itemId || !delta)
            return ops;
        ops.push({
            op: "text_delta",
            id: `v2:cmd-${safeTurnId}:${itemId}`,
            ts: nowMs,
            role: "system",
            delta,
            render: "terminal",
        });
        return ops;
    }
    if (method === "item/fileChange/outputDelta") {
        // 文件变更正文改为按需加载；聊天实时流不再下发 patch/output 增量。
        return ops;
    }
    // Some builds may use slightly different naming for fileChange streaming payloads; best-effort attach.
    if (method.startsWith("item/") && method.toLowerCase().includes("filechange") && method.toLowerCase().endsWith("delta")) {
        // 同上：统一屏蔽 fileChange delta 的实时下发。
        return ops;
    }
    if (method === "item/completed") {
        const item = params?.item;
        const itemId = typeof item?.id === "string" ? item.id : "";
        const itemType = typeof item?.type === "string" ? item.type : "";
        const turnId = String(params?.turnId ?? "").trim();
        const safeTurnId = turnId || `t-${nowMs}`;
        if (itemType === "agentMessage") {
            const text = String(item?.text ?? "");
            const safeItemId = itemId || input.resolveFallbackId("am");
            ops.push({
                op: "upsert",
                preserveTs: true,
                item: (0, chatItemEnricher_1.enrichChatItemForUi)({
                    id: `v2:am-${safeTurnId}:${safeItemId}`,
                    ts: nowMs,
                    role: "assistant",
                    text,
                    streaming: false,
                }),
            });
            return ops;
        }
        if (itemType === "plan") {
            const safeItemId = itemId || input.resolveFallbackId("plan");
            const id = `v2:plan-${safeTurnId}:${safeItemId}`;
            const text = String(item?.text ?? "");
            if (text.trim()) {
                ops.push({
                    op: "upsert",
                    preserveTs: true,
                    item: (0, chatItemEnricher_1.enrichChatItemForUi)({ id, ts: nowMs, role: "assistant", text, streaming: false }),
                });
            }
            else {
                ops.push({ op: "finalize", id, ts: nowMs, patch: { text, markdownAst: null, systemToolCallSummary: null } });
            }
            return ops;
        }
        if (itemType === "reasoning") {
            const summary = Array.isArray(item?.summary) ? item.summary.map(String).filter(Boolean) : [];
            if (!summary.length)
                return ops;
            const safeItemId = itemId || input.resolveFallbackId("rs");
            const base = `v2:rs-${safeTurnId}:${safeItemId}:`;
            // 确保每条 summary 都存在（部分 server 只发 completed payload）。
            for (let i = 0; i < summary.length; i += 1) {
                const text = String(summary[i] ?? "").trim();
                if (!text)
                    continue;
                const id = `${base}${i}`;
                ops.push({
                    op: "upsert",
                    preserveTs: true,
                    item: (0, chatItemEnricher_1.enrichChatItemForUi)({ id, ts: nowMs, role: "reasoning", text, streaming: false }),
                });
            }
            // 标记所有同前缀 in-flight delta 为 done，便于 UI 自动折叠。
            ops.push({ op: "mark_streaming_done_by_prefix", ts: nowMs, prefix: base });
            return ops;
        }
        if (itemType === "commandExecution") {
            const safeItemId = itemId || input.resolveFallbackId("cmd-final");
            const id = `v2:cmd-${safeTurnId}:${safeItemId}`;
            const command = String(item?.command ?? "").trim();
            const header = formatCommandTranscript(stripBashLcAndEscape(command));
            const skillCallMarker = (0, skillCallMarker_1.extractSkillCallMarkerFromCommandExecutionItem)(item);
            const output = String(item?.aggregatedOutput ?? "");
            const status = String(item?.status ?? "").trim();
            const exitCode = typeof item?.exitCode === "number" ? item.exitCode : null;
            const durationMs = typeof item?.durationMs === "number" ? item.durationMs : null;
            const nextTextParts = [header];
            if (output) {
                nextTextParts.push(output);
                if (!output.endsWith("\n"))
                    nextTextParts.push("\n");
            }
            const statusLineParts = [];
            if (exitCode !== null)
                statusLineParts.push(exitCode === 0 ? "✓" : `✗ (code: ${exitCode})`);
            else if (status)
                statusLineParts.push(status);
            if (durationMs !== null)
                statusLineParts.push(fmtDurationMs(durationMs));
            if (statusLineParts.length) {
                const lead = statusLineParts[0] ?? "";
                const tail = statusLineParts.slice(1).join(" • ");
                nextTextParts.push(`${tail ? `${lead} • ${tail}` : lead}\n`);
            }
            const text = nextTextParts.join("");
            ops.push({
                op: "upsert",
                preserveTs: true,
                item: (0, chatItemEnricher_1.enrichChatItemForUi)({ id, ts: nowMs, role: "system", text, streaming: false, render: "terminal", skillCallMarker }),
            });
            return ops;
        }
        {
            const safeItemId = itemId || input.resolveFallbackId("fc-final");
            const id = `v2:fc-${safeTurnId}:${safeItemId}`;
            const normalizedType = itemType.trim().toLowerCase();
            const changes = (0, fileChangeExtractor_1.extractFileChangesFromAny)(item);
            const looksLikeFileChange = normalizedType === "filechange" ||
                normalizedType === "file_change" ||
                normalizedType.includes("file") ||
                normalizedType.includes("patch");
            if (!looksLikeFileChange)
                return ops;
            if (!changes.length) {
                ops.push({ op: "finalize", id, ts: nowMs, patch: { render: "diff" } });
                return ops;
            }
            const title = "文件变更";
            const summaryChanges = toDiffSummaryChanges(changes);
            const diff = { title, changes: summaryChanges };
            ops.push({
                op: "upsert",
                preserveTs: true,
                item: (0, chatItemEnricher_1.enrichChatItemForUi)({ id, ts: nowMs, role: "system", text: title, streaming: false, render: "diff", diff }),
            });
            return ops;
        }
    }
    if (method === "turn/diff/updated" || method === "turn/diff/created") {
        const turnId = String(params?.turnId ?? "").trim();
        const safeTurnId = turnId || `t-${nowMs}`;
        const diff = params?.diff;
        const changes = (0, fileChangeExtractor_1.extractFileChangesFromAny)(diff ?? params);
        if (!turnId || !changes.length)
            return ops;
        const id = `v2:turn-diff:${safeTurnId}`;
        const title = "本回合总变更";
        const summaryChanges = toDiffSummaryChanges(changes);
        ops.push({
            op: "upsert",
            item: (0, chatItemEnricher_1.enrichChatItemForUi)({
                id,
                ts: nowMs,
                role: "system",
                text: title,
                streaming: false,
                render: "diff",
                diff: { title, changes: summaryChanges },
            }),
        });
        return ops;
    }
    // Generic fallback: if we see a changes list in params, surface it.
    {
        const changes = (0, fileChangeExtractor_1.extractFileChangesFromAny)(params);
        if (changes.length) {
            const turnId = String(params?.turnId ?? params?.turn_id ?? "").trim();
            const itemId = String(params?.itemId ?? params?.item_id ?? "").trim();
            const id = `fc:${method}:${turnId || "t"}:${itemId || "i"}:${nowMs}`;
            const title = "文件变更";
            const summaryChanges = toDiffSummaryChanges(changes);
            ops.push({
                op: "upsert",
                item: (0, chatItemEnricher_1.enrichChatItemForUi)({
                    id,
                    ts: nowMs,
                    role: "system",
                    text: title,
                    streaming: false,
                    render: "diff",
                    diff: { title, changes: summaryChanges },
                }),
            });
            return ops;
        }
    }
    // Mark any in-flight output as done when a turn finishes (avoid a "stuck cursor" on errors).
    if (method === "turn/completed" || method === "turn/failed" || method === "turn/cancelled" || method === "turn/interrupted") {
        ops.push({ op: "mark_all_streaming_done", ts: nowMs });
        return ops;
    }
    return ops;
}
function stripOuterQuotesAndUnescape(input) {
    if (input.length < 2)
        return null;
    const quote = input[0];
    if (quote !== "'" && quote !== '"')
        return null;
    if (!input.endsWith(quote))
        return null;
    const inner = input.slice(1, -1);
    if (!inner)
        return "";
    let out = "";
    for (let i = 0; i < inner.length; i += 1) {
        const ch = inner[i];
        if (ch !== "\\\\") {
            out += ch;
            continue;
        }
        const next = inner[i + 1];
        if (next === undefined)
            break;
        i += 1;
        if (next === "n")
            out += "\\n";
        else if (next === "t")
            out += "\\t";
        else if (next === "r")
            out += "\\r";
        else if (next === "\\\\")
            out += "\\\\";
        else if (next === '"' && quote === '"')
            out += '"';
        else if (next === "'" && quote === "'")
            out += "'";
        else
            out += next;
    }
    return out;
}
function stripBashLcAndEscape(command) {
    const prefix = "bash -lc ";
    if (!command.startsWith(prefix))
        return command;
    const rest = command.slice(prefix.length);
    return stripOuterQuotesAndUnescape(rest) ?? rest;
}
function formatCommandTranscript(script) {
    const lines = script.replace(/\\r\\n/g, "\\n").split("\\n");
    if (!lines.length)
        return "$\\n";
    const out = [];
    out.push(`$ ${lines[0] ?? ""}`);
    for (let i = 1; i < lines.length; i += 1)
        out.push(`  ${lines[i] ?? ""}`);
    return `${out.join("\\n")}\\n`;
}
function fmtDurationMs(durationMs) {
    const totalMs = Math.max(0, Math.trunc(durationMs));
    const secs = Math.floor(totalMs / 1000);
    const millis = totalMs % 1000;
    if (secs >= 60) {
        const minutes = Math.floor(secs / 60);
        const seconds = secs % 60;
        return `${minutes}m${seconds}s`;
    }
    if (secs > 0) {
        if (millis >= 100) {
            if (secs < 10)
                return `${secs}.${Math.floor(millis / 100)}s`;
            return `${secs}s`;
        }
        return `${secs}.${String(millis).padStart(3, "0")}s`;
    }
    if (millis >= 100)
        return `${millis}ms`;
    return `0.${String(millis).padStart(3, "0")}ms`;
}
//# sourceMappingURL=codexEventProjector.js.map