export type CwdSuggestErrorCode = "invalid_query" | "path_not_allowed";
export declare class CwdSuggestError extends Error {
    readonly code: CwdSuggestErrorCode;
    constructor(code: CwdSuggestErrorCode, message: string);
}
export declare function suggestCwds(opts: {
    query: string;
    limit?: number;
    allowAnyRoot?: boolean;
    allowedRoots?: string[];
}): Promise<string[]>;
