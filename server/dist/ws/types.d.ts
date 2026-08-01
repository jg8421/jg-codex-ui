import type { ChatItem, ChatOp, FileChange } from "../chat/types";
import type { TodoPlanUpdate } from "../chat/todoPlanTypes";
export type WsClientMessage = {
    type: "hello";
    token: string;
    clientVersion?: string;
} | {
    type: "get_status";
} | {
    type: "list_threads";
    cwd?: string;
    requestId?: string;
} | {
    type: "open_thread";
    threadId?: string;
    clientMessageId?: string;
    cwd?: string;
    approvalPolicy?: "untrusted" | "on-failure" | "on-request" | "never";
    sandbox?: "read-only" | "workspace-write" | "danger-full-access";
    model?: string;
} | {
    type: "load_thread_turns";
    threadId: string;
    before: number;
    limit?: number;
    clientMessageId?: string;
} | {
    type: "submit";
    threadId: string;
    text: string;
    model?: string;
    effort?: string;
    reasoningEffort?: string;
    serviceTier?: "fast";
    approvalPolicy?: "untrusted" | "on-failure" | "on-request" | "never";
    sandbox?: "read-only" | "workspace-write" | "danger-full-access";
    collaborationMode?: unknown;
    clientMessageId?: string;
} | {
    type: "interrupt";
    threadId: string;
    clientMessageId?: string;
} | {
    type: "respond_user_input";
    requestId: string | number;
    response: unknown;
    clientMessageId?: string;
};
export type WsServerMessage = {
    type: "ack";
    ackType: "submit" | "open_thread" | "load_thread_turns" | "interrupt" | "respond_user_input";
    clientMessageId: string;
    threadId?: string;
    requestId?: string | number;
} | {
    type: "ready";
    serverVersion: string;
    threads: unknown[];
} | {
    type: "status";
    snapshot: {
        codex?: unknown;
        codexTask?: unknown;
        ws?: unknown;
    };
} | {
    type: "threads";
    threads: unknown[];
    requestId?: string;
    cwd?: string | null;
} | {
    type: "thread_opened";
    thread: unknown;
    chatItems?: ChatItem[];
} | {
    type: "thread_turns";
    threadId: string;
    turns: unknown[];
    turnsStart: number;
    turnsTotal: number;
    chatItems?: ChatItem[];
} | {
    type: "chat_ops";
    threadId: string;
    ops: ChatOp[];
} | {
    type: "todo_plan_update";
    update: TodoPlanUpdate;
} | {
    type: "thread_context_usage";
    threadId: string;
    usagePercent: number;
} | {
    type: "user_input_required";
    requestId: string | number;
    threadId: string | null;
    method: string;
    params: unknown;
    fileChanges?: FileChange[];
} | {
    type: "user_input_resolved";
    requestId: string | number;
    threadId: string | null;
    method?: string;
    response?: unknown;
    mappedResponse?: unknown;
    requestParams?: unknown;
} | {
    type: "error";
    message: string;
    details?: unknown;
    clientMessageId?: string;
    requestId?: string;
};
