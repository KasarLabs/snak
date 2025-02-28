export declare const WAD_DECIMALS = 18;
export declare const RAY_DECIMALS = 27;
type DecimalTypes = 'wad' | 'ray';
export declare function formatValue(value: bigint, type?: DecimalTypes, decimals?: number): string;
export {};
