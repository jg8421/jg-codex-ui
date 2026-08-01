import { Server as SocketIoServer, Socket } from "socket.io";
/**
 * Socket.IO bridge 的生命周期句柄。
 */
export type SocketIoBridge = {
    /**
     * 清理 bridge 绑定的事件监听。
     */
    dispose: () => void;
};
/**
 * 生成上游 ws URL 的参数。
 */
type UpstreamWsUrlFactoryInput = {
    socket: Socket;
    rawWsPath: string;
    host: string;
    port: number;
};
/**
 * 创建 Socket.IO bridge 的入参。
 */
type CreateSocketIoBridgeInput = {
    ioServer: SocketIoServer;
    rawWsPath?: string;
    upstreamWsUrlFactory?: (input: UpstreamWsUrlFactoryInput) => string;
};
/**
 * 创建 Socket.IO -> 原 ws Hub 的桥接层。
 */
export declare function createSocketIoBridge(input: CreateSocketIoBridgeInput): SocketIoBridge;
export {};
