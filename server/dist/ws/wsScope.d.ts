import type { IncomingMessage } from "http";
/**
 * WsScope 决定该 WS 连接会收到哪一类消息：
 * - `global`: 只收全局状态与审批相关消息
 * - `thread`: 只收当前激活 threadId 的线程消息
 * - `all`: 兼容旧客户端，保持现状（global + thread 都收）
 */
export type WsScope = "all" | "global" | "thread";
/**
 * 从 `IncomingMessage.url` 解析 `scope` query 参数。
 *
 * 约定：
 * - `/ws?scope=global` -> `"global"`
 * - `/ws?scope=thread` -> `"thread"`
 * - 缺失/非法 -> `"all"`（兼容旧客户端）
 */
export declare function parseWsScopeFromRequest(req: IncomingMessage): WsScope;
