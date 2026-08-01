export declare function isLoopbackAddress(address: string | undefined): boolean;
export type OriginPolicy = {
    strict: boolean;
    allowedOrigins: string[];
};
/**
 * 判断请求 Origin 是否允许。
 * - strict=false：不做限制；
 * - strict=true：若存在 Origin，则必须命中 allowlist；Origin 为空时放行（兼容非浏览器客户端）。
 */
export declare function isAllowedOrigin(origin: string | undefined, policy: OriginPolicy): boolean;
