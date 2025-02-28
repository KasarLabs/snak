export interface SignatureTool<P = any> {
    name: string;
    categorie?: string;
    description: string;
    schema?: object;
    execute: (params: P) => Promise<unknown>;
}
export declare class StarknetSignatureToolRegistry {
    private static tools;
    static RegisterSignatureTools<P>(tool: SignatureTool<P>): void;
    static createSignatureTools(allowed_signature_tools: string[]): Promise<import("@langchain/core/tools").DynamicStructuredTool<any>[]>;
}
export declare const RegisterSignatureTools: (allowed_signature_tools: string[], tools: SignatureTool[]) => Promise<void>;
export declare const createSignatureTools: (allowed_signature_tools: string[]) => Promise<import("@langchain/core/tools").DynamicStructuredTool<any>[]>;
export default StarknetSignatureToolRegistry;
