"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonRpcClient = void 0;
class JsonRpcClient {
    transport;
    opts;
    idCounter = 0;
    pendingRequests = new Map();
    notificationHandlers = new Set();
    serverRequestHandler = null;
    constructor(transport, opts = {}) {
        this.transport = transport;
        this.opts = opts;
    }
    onNotification(handler) {
        this.notificationHandlers.add(handler);
        return () => this.notificationHandlers.delete(handler);
    }
    onServerRequest(handler) {
        this.serverRequestHandler = handler;
    }
    request(method, params) {
        const id = this.nextId();
        const timeoutMs = this.opts.timeoutMs ?? 60_000;
        const promise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`JSON-RPC request timed out: ${method}`));
            }, timeoutMs);
            this.pendingRequests.set(id, { resolve: (v) => resolve(v), reject, timeout });
        });
        this.transport.send({ jsonrpc: "2.0", id, method, params });
        return promise;
    }
    notify(method, params) {
        this.transport.send({ jsonrpc: "2.0", method, params });
    }
    respond(id, result) {
        const message = { jsonrpc: "2.0", id, result };
        this.transport.send(message);
    }
    respondError(id, error) {
        const message = { jsonrpc: "2.0", id, error };
        this.transport.send(message);
    }
    async handleMessage(message) {
        if (typeof message !== "object" || message === null)
            return;
        const msg = message;
        const hasId = msg.id !== undefined && msg.id !== null;
        const hasMethod = typeof msg.method === "string";
        if (hasMethod && hasId) {
            const req = { id: msg.id, method: msg.method, params: msg.params };
            if (!this.serverRequestHandler) {
                this.respondError(req.id, { code: -32601, message: "No server request handler registered" });
                return;
            }
            try {
                const result = await this.serverRequestHandler(req);
                this.respond(req.id, result);
            }
            catch (err) {
                this.respondError(req.id, { code: -32000, message: "Server request handler failed", data: String(err) });
            }
            return;
        }
        if (hasMethod && !hasId) {
            for (const handler of this.notificationHandlers) {
                handler(msg.method, msg.params);
            }
            return;
        }
        if (hasId && ("result" in msg || "error" in msg)) {
            const pending = this.pendingRequests.get(msg.id);
            if (!pending)
                return;
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(msg.id);
            if (msg.error) {
                const error = msg.error;
                pending.reject(Object.assign(new Error(error.message), { code: error.code, data: error.data }));
            }
            else {
                pending.resolve(msg.result);
            }
            return;
        }
    }
    nextId() {
        this.idCounter += 1;
        const prefix = this.opts.idPrefix ?? "c-";
        return `${prefix}${this.idCounter}`;
    }
}
exports.JsonRpcClient = JsonRpcClient;
//# sourceMappingURL=jsonrpc.js.map