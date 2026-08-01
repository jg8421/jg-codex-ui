"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadBusySubmitError = void 0;
exports.isThreadActiveInStatusSnapshot = isThreadActiveInStatusSnapshot;
exports.submitTurnWithBusyInterruption = submitTurnWithBusyInterruption;
/**
 * 专门表示“线程仍忙，当前 stop+resubmit 无法继续”的业务错误。
 */
class ThreadBusySubmitError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "ThreadBusySubmitError";
    }
}
exports.ThreadBusySubmitError = ThreadBusySubmitError;
/**
 * 从状态快照判断指定线程是否仍有活跃 turn。
 */
function isThreadActiveInStatusSnapshot(input) {
    /**
     * normalizedThreadId：统一 trim，避免空白 threadId 被误判成活动线程。
     */
    const normalizedThreadId = String(input.threadId ?? "").trim();
    if (!normalizedThreadId)
        return false;
    /**
     * activeByThread：Codex 任务跟踪器暴露的每线程活跃 turn 数。
     */
    const activeByThread = input.snapshot?.codexTask?.activeByThread;
    /**
     * activeTurnCount：目标线程当前活跃 turn 数；非数字时按 0 处理。
     */
    const activeTurnCount = Number(activeByThread?.[normalizedThreadId] ?? 0);
    return Number.isFinite(activeTurnCount) && activeTurnCount > 0;
}
/**
 * 当线程正在运行时，先 interrupt 当前活跃 turn，再等待 idle 后启动新 turn。
 */
async function submitTurnWithBusyInterruption(input) {
    /**
     * normalizedThreadId：后续 interrupt / startTurn 都使用统一 threadId。
     */
    const normalizedThreadId = String(input.threadId ?? "").trim();
    /**
     * idlePollIntervalMs：轮询线程 idle 的间隔，保持足够短以减少用户等待。
     */
    const idlePollIntervalMs = Number.isFinite(input.idlePollIntervalMs) && Number(input.idlePollIntervalMs) > 0 ? Math.floor(Number(input.idlePollIntervalMs)) : 50;
    /**
     * idleTimeoutMs：等待线程真正空闲的最长时间，超时后直接返回明确错误。
     */
    const idleTimeoutMs = Number.isFinite(input.idleTimeoutMs) && Number(input.idleTimeoutMs) > 0 ? Math.floor(Number(input.idleTimeoutMs)) : 5_000;
    /**
     * sleep：默认使用 setTimeout 包装 Promise，便于测试替换。
     */
    const sleep = input.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    /**
     * initialSnapshot：提交时读取一次权威状态，决定是否需要走 stop+resubmit。
     */
    const initialSnapshot = input.getStatusSnapshot?.() ?? null;
    if (!isThreadActiveInStatusSnapshot({ snapshot: initialSnapshot, threadId: normalizedThreadId })) {
        return input.codex.startTurn(normalizedThreadId, input.text, input.turnOpts);
    }
    /**
     * activeTurnIds：只要线程 busy，就必须明确知道当前要 interrupt 的 turn ids。
     */
    const activeTurnIds = (input.getActiveTurnIds?.(normalizedThreadId) ?? []).map((turnId) => String(turnId ?? "").trim()).filter(Boolean);
    if (!activeTurnIds.length) {
        throw new ThreadBusySubmitError("busy_no_active_turns", `thread is busy but active turn ids are unavailable: ${normalizedThreadId}`);
    }
    /**
     * interruptResults：并发中断当前线程的全部活跃 turn。
     */
    const interruptResults = await Promise.allSettled(activeTurnIds.map((turnId) => input.codex.interruptTurn(normalizedThreadId, turnId)));
    /**
     * successfulInterruptCount：至少需要一个 interrupt 真正发送成功，否则无法继续等待 idle。
     */
    const successfulInterruptCount = interruptResults.filter((result) => result.status === "fulfilled").length;
    if (successfulInterruptCount === 0) {
        /**
         * firstInterruptError：保留第一个失败原因，便于 API 直接返回人能看懂的错误。
         */
        const firstInterruptError = interruptResults.find((result) => result.status === "rejected")?.reason ?? "interrupt failed";
        throw new ThreadBusySubmitError("interrupt_failed", `failed to interrupt active turn(s) for thread ${normalizedThreadId}: ${String(firstInterruptError?.message ?? firstInterruptError)}`);
    }
    /**
     * waitStartedAtMs：等待 idle 的起点时间，用于计算超时。
     */
    const waitStartedAtMs = Date.now();
    while (true) {
        /**
         * currentSnapshot：每次轮询都重新读取任务跟踪状态，直到目标线程退出 busy。
         */
        const currentSnapshot = input.getStatusSnapshot?.() ?? null;
        if (!isThreadActiveInStatusSnapshot({ snapshot: currentSnapshot, threadId: normalizedThreadId })) {
            break;
        }
        if (Date.now() - waitStartedAtMs >= idleTimeoutMs) {
            throw new ThreadBusySubmitError("busy_timeout", `thread did not become idle in time: ${normalizedThreadId}`);
        }
        await sleep(idlePollIntervalMs);
    }
    return input.codex.startTurn(normalizedThreadId, input.text, input.turnOpts);
}
//# sourceMappingURL=threadBusySubmit.js.map