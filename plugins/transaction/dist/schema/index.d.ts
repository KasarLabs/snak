import z from 'zod';
export declare const declareContractSchema: z.ZodObject<{
    contract: z.ZodAny;
    classHash: z.ZodOptional<z.ZodString>;
    compiledClassHash: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    contract?: any;
    classHash?: string | undefined;
    compiledClassHash?: string | undefined;
}, {
    contract?: any;
    classHash?: string | undefined;
    compiledClassHash?: string | undefined;
}>;
export declare const simulateInvokeTransactionSchema: z.ZodObject<{
    accountAddress: z.ZodString;
    payloads: z.ZodArray<z.ZodObject<{
        contractAddress: z.ZodString;
        entrypoint: z.ZodString;
        calldata: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodAny>]>>;
    }, "strip", z.ZodTypeAny, {
        contractAddress: string;
        entrypoint: string;
        calldata?: string[] | Record<string, any> | undefined;
    }, {
        contractAddress: string;
        entrypoint: string;
        calldata?: string[] | Record<string, any> | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    accountAddress: string;
    payloads: {
        contractAddress: string;
        entrypoint: string;
        calldata?: string[] | Record<string, any> | undefined;
    }[];
}, {
    accountAddress: string;
    payloads: {
        contractAddress: string;
        entrypoint: string;
        calldata?: string[] | Record<string, any> | undefined;
    }[];
}>;
export declare const simulateDeployAccountTransactionSchema: z.ZodObject<{
    accountAddress: z.ZodString;
    payloads: z.ZodArray<z.ZodObject<{
        classHash: z.ZodString;
        constructorCalldata: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodAny>]>>;
        addressSalt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
        contractAddressSchema: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        classHash: string;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        contractAddressSchema?: string | undefined;
    }, {
        classHash: string;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        contractAddressSchema?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    accountAddress: string;
    payloads: {
        classHash: string;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        contractAddressSchema?: string | undefined;
    }[];
}, {
    accountAddress: string;
    payloads: {
        classHash: string;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        contractAddressSchema?: string | undefined;
    }[];
}>;
export declare const simulateDeployTransactionSchema: z.ZodObject<{
    accountAddress: z.ZodString;
    payloads: z.ZodArray<z.ZodObject<{
        classHash: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>;
        addressSalt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
        unique: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodBoolean]>>;
        constructorCalldata: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodAny>]>>;
    }, "strip", z.ZodTypeAny, {
        classHash: string | number | bigint;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        unique?: string | boolean | undefined;
    }, {
        classHash: string | number | bigint;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        unique?: string | boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    accountAddress: string;
    payloads: {
        classHash: string | number | bigint;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        unique?: string | boolean | undefined;
    }[];
}, {
    accountAddress: string;
    payloads: {
        classHash: string | number | bigint;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        unique?: string | boolean | undefined;
    }[];
}>;
export declare const simulateDeclareTransactionSchema: z.ZodObject<{
    accountAddress: z.ZodString;
    contract: z.ZodUnion<[z.ZodString, z.ZodObject<{
        program: z.ZodAny;
        entry_points_by_type: z.ZodAny;
    }, "strip", z.ZodTypeAny, {
        entry_points_by_type?: any;
        program?: any;
    }, {
        entry_points_by_type?: any;
        program?: any;
    }>]>;
    classHash: z.ZodOptional<z.ZodString>;
    casm: z.ZodOptional<z.ZodObject<{
        prime: z.ZodString;
        compiler_version: z.ZodString;
        bytecode: z.ZodArray<z.ZodString, "many">;
        hints: z.ZodRecord<z.ZodString, z.ZodAny>;
        entry_points_by_type: z.ZodObject<{
            CONSTRUCTOR: z.ZodArray<z.ZodAny, "many">;
            EXTERNAL: z.ZodArray<z.ZodAny, "many">;
            L1_HANDLER: z.ZodArray<z.ZodAny, "many">;
        }, "strip", z.ZodTypeAny, {
            CONSTRUCTOR: any[];
            EXTERNAL: any[];
            L1_HANDLER: any[];
        }, {
            CONSTRUCTOR: any[];
            EXTERNAL: any[];
            L1_HANDLER: any[];
        }>;
    }, "strip", z.ZodTypeAny, {
        prime: string;
        compiler_version: string;
        bytecode: string[];
        hints: Record<string, any>;
        entry_points_by_type: {
            CONSTRUCTOR: any[];
            EXTERNAL: any[];
            L1_HANDLER: any[];
        };
    }, {
        prime: string;
        compiler_version: string;
        bytecode: string[];
        hints: Record<string, any>;
        entry_points_by_type: {
            CONSTRUCTOR: any[];
            EXTERNAL: any[];
            L1_HANDLER: any[];
        };
    }>>;
    compiledClassHash: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    contract: string | {
        entry_points_by_type?: any;
        program?: any;
    };
    accountAddress: string;
    classHash?: string | undefined;
    compiledClassHash?: string | undefined;
    casm?: {
        prime: string;
        compiler_version: string;
        bytecode: string[];
        hints: Record<string, any>;
        entry_points_by_type: {
            CONSTRUCTOR: any[];
            EXTERNAL: any[];
            L1_HANDLER: any[];
        };
    } | undefined;
}, {
    contract: string | {
        entry_points_by_type?: any;
        program?: any;
    };
    accountAddress: string;
    classHash?: string | undefined;
    compiledClassHash?: string | undefined;
    casm?: {
        prime: string;
        compiler_version: string;
        bytecode: string[];
        hints: Record<string, any>;
        entry_points_by_type: {
            CONSTRUCTOR: any[];
            EXTERNAL: any[];
            L1_HANDLER: any[];
        };
    } | undefined;
}>;
export declare const estimateAccountDeployFeeSchema: z.ZodObject<{
    accountAddress: z.ZodString;
    payloads: z.ZodArray<z.ZodObject<{
        classHash: z.ZodString;
        constructorCalldata: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodAny>]>>;
        addressSalt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
        contractAddressSchema: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        classHash: string;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        contractAddressSchema?: string | undefined;
    }, {
        classHash: string;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        contractAddressSchema?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    accountAddress: string;
    payloads: {
        classHash: string;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        contractAddressSchema?: string | undefined;
    }[];
}, {
    accountAddress: string;
    payloads: {
        classHash: string;
        constructorCalldata?: string[] | Record<string, any> | undefined;
        addressSalt?: string | number | bigint | undefined;
        contractAddressSchema?: string | undefined;
    }[];
}>;
