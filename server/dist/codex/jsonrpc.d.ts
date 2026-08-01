export type JsonRpcId = string | number;
export type JsonRpcError = {
    code: number;
    message: string;
    data?: unknown;
};
export type JsonRpcResponse = {
    jsonrpc: "2.0";
    id: JsonRpcId;
    result?: unknown;
    error?: JsonRpcError;
};
export interface JsonRpcTransport {
    send(message: unknown): void;
}
export type ServerRequest = {
    id: JsonRpcId;
    method: string;
    params: unknown;
};
type NotificationHandler = (method: string, params: unknown) => void;
type ServerRequestHandler = (req: ServerRequest) => Promise<unknown> | unknown;
export declare class JsonRpcClient {
    private readonly transport;
    private readonly opts;
    private idCounter;
    private pendingRequests;
    private notificationHandlers;
    private serverRequestHandler;
    constructor(transport: JsonRpcTransport, opts?: {
        timeoutMs?: number;
        idPrefix?: string;
    });
    onNotification(handler: NotificationHandler): () => void;
    onServerRequest(handler: ServerRequestHandler): void;
    request<T = unknown>(method: string, params?: unknown): Promise<T>;
    notify(method: string, params?: unknown): void;
    respond(id: JsonRpcId, result: unknown): void;
    respondError(id: JsonRpcId, error: JsonRpcError): void;
    handleMessage(message: unknown): Promise<void>;
    private nextId;
}
export {};
