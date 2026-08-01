import { type ChildProcessWithoutNullStreams } from "child_process";
import { EventEmitter } from "events";
import { type CodexHistoryPersistence } from "./cliArgs";
type AppServerProcessEvents = {
    message: (msg: unknown) => void;
    stderr: (line: string) => void;
    exit: (code: number | null, signal: NodeJS.Signals | null) => void;
};
export declare class AppServerProcess extends EventEmitter {
    readonly child: ChildProcessWithoutNullStreams;
    private readonly decoder;
    constructor(opts: {
        codexBin: string;
        args?: string[];
        cwd: string;
        env?: NodeJS.ProcessEnv;
        historyPersistence?: CodexHistoryPersistence | null;
        disableResponseStorage?: boolean | null;
    });
    send(message: unknown): void;
    dispose(): void;
    on<E extends keyof AppServerProcessEvents>(event: E, listener: AppServerProcessEvents[E]): this;
}
export {};
