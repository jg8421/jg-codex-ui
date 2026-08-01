"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSocketIoBridge = createSocketIoBridge;
const ws_1 = __importDefault(require("ws"));
/**
 * 连接桥中的消息事件名，统一复用单一事件承载现有 ws 协议对象。
 */
const SOCKET_IO_MESSAGE_EVENT = "message";
/**
 * 创建 Socket.IO -> 原 ws Hub 的桥接层。
 */
function createSocketIoBridge(input) {
    /**
     * 目标 ws path，默认沿用现有 ws hub 路径。
     */
    const rawWsPath = input.rawWsPath ?? "/ws";
    /**
     * 统一处理 Socket.IO 客户端连接，并桥接到内部 ws。
     */
    const onConnection = (socket) => {
        /**
         * 上游 ws 地址，默认指向当前进程监听端口。
         */
        const upstreamWsUrl = buildUpstreamWsUrl({
            socket,
            rawWsPath,
            upstreamWsUrlFactory: input.upstreamWsUrlFactory,
        });
        /**
         * 透传 cookie 到上游 ws，以复用现有鉴权逻辑。
         */
        const cookieHeader = typeof socket.handshake.headers.cookie === "string" ? socket.handshake.headers.cookie : "";
        /**
         * 上游 ws 客户端实例。
         */
        const upstreamWs = new ws_1.default(upstreamWsUrl, cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined);
        /**
         * 在 socket.io 侧发送标准化错误消息。
         */
        const emitBridgeError = (message, details) => {
            socket.emit(SOCKET_IO_MESSAGE_EVENT, {
                type: "error",
                message,
                details,
            });
        };
        /**
         * socket.io -> ws：转发前端消息。
         */
        const onSocketMessage = (payload) => {
            if (upstreamWs.readyState !== ws_1.default.OPEN)
                return;
            try {
                upstreamWs.send(JSON.stringify(payload));
            }
            catch (err) {
                emitBridgeError("socket.io bridge send failed", String(err));
            }
        };
        /**
         * ws -> socket.io：转发服务端消息。
         */
        const onUpstreamMessage = (buffer) => {
            const raw = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer);
            try {
                const parsed = JSON.parse(raw);
                socket.emit(SOCKET_IO_MESSAGE_EVENT, parsed);
            }
            catch {
                // 仅透传 JSON 协议消息，非 JSON 直接忽略。
            }
        };
        /**
         * 上游 ws 关闭后，主动断开 socket.io 客户端，触发其重连策略。
         */
        const onUpstreamClose = (code, reasonBuffer) => {
            if (code === 1008) {
                emitBridgeError("unauthorized", reasonBuffer.toString("utf8"));
            }
            if (socket.connected)
                socket.disconnect(true);
        };
        /**
         * 上游 ws 错误处理，便于前端可观测。
         */
        const onUpstreamError = (err) => {
            emitBridgeError("socket.io bridge upstream error", String(err));
            if (socket.connected)
                socket.disconnect(true);
        };
        /**
         * socket.io 断开时，清理上游 ws。
         */
        const onSocketDisconnect = () => {
            if (upstreamWs.readyState === ws_1.default.OPEN || upstreamWs.readyState === ws_1.default.CONNECTING) {
                upstreamWs.close();
            }
        };
        socket.on(SOCKET_IO_MESSAGE_EVENT, onSocketMessage);
        socket.on("disconnect", onSocketDisconnect);
        upstreamWs.on("message", onUpstreamMessage);
        upstreamWs.on("close", onUpstreamClose);
        upstreamWs.on("error", onUpstreamError);
    };
    input.ioServer.on("connection", onConnection);
    return {
        dispose: () => {
            input.ioServer.off("connection", onConnection);
        },
    };
}
/**
 * 构建上游 ws 地址。
 */
function buildUpstreamWsUrl(input) {
    /**
     * 基于本地监听地址推导可回环访问的 host。
     */
    const host = normalizeLoopbackHost(resolveLocalAddress(input.socket));
    /**
     * 当前连接可解析出的本地端口。
     */
    const port = resolveLocalPort(input.socket);
    if (input.upstreamWsUrlFactory) {
        return input.upstreamWsUrlFactory({
            socket: input.socket,
            rawWsPath: input.rawWsPath,
            host,
            port,
        });
    }
    if (!port || !Number.isFinite(port))
        throw new Error("socket.io bridge failed to resolve local port");
    return `ws://${host}:${port}${input.rawWsPath}`;
}
/**
 * 将监听地址标准化为可用于回环连接的 host。
 */
function normalizeLoopbackHost(host) {
    const normalizedHost = String(host || "").trim().toLowerCase();
    if (!normalizedHost)
        return "127.0.0.1";
    if (normalizedHost === "::" || normalizedHost === "0.0.0.0")
        return "127.0.0.1";
    if (normalizedHost === "::1")
        return "127.0.0.1";
    if (normalizedHost.startsWith("::ffff:"))
        return normalizedHost.slice("::ffff:".length);
    return normalizedHost;
}
/**
 * 解析 Socket.IO 连接的本地地址（用于构建回环 ws URL）。
 */
function resolveLocalAddress(socket) {
    const fromRequest = socket.request?.socket?.localAddress;
    const fromConnRequest = socket.conn?.request?.socket?.localAddress;
    const fromConnTransport = socket.conn?.transport?.socket?.localAddress;
    const fromServer = resolveServerAddress(socket)?.address;
    return String(fromRequest || fromConnRequest || fromConnTransport || fromServer || "127.0.0.1");
}
/**
 * 解析 Socket.IO 连接对应的本地端口。
 */
function resolveLocalPort(socket) {
    const fromRequest = Number(socket.request?.socket?.localPort || 0);
    if (Number.isFinite(fromRequest) && fromRequest > 0)
        return fromRequest;
    const fromConnRequest = Number(socket.conn?.request?.socket?.localPort || 0);
    if (Number.isFinite(fromConnRequest) && fromConnRequest > 0)
        return fromConnRequest;
    const fromConnTransport = Number(socket.conn?.transport?.socket?.localPort || 0);
    if (Number.isFinite(fromConnTransport) && fromConnTransport > 0)
        return fromConnTransport;
    const fromServer = Number(resolveServerAddress(socket)?.port || 0);
    if (Number.isFinite(fromServer) && fromServer > 0)
        return fromServer;
    return 0;
}
/**
 * 从 Socket.IO server 提取监听地址对象。
 */
function resolveServerAddress(socket) {
    const httpServer = socket.nsp?.server?.httpServer;
    if (!httpServer)
        return null;
    const serverAddress = httpServer.address();
    if (!serverAddress || typeof serverAddress === "string")
        return null;
    return serverAddress;
}
//# sourceMappingURL=socketIoBridge.js.map