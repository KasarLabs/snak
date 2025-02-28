import { z } from 'zod';
export declare const placePixelParamSchema: z.ZodObject<{
    canvasId: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>>;
    xPos: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    yPos: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    color: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    color: string;
    canvasId: string | number;
    xPos?: number | null | undefined;
    yPos?: number | null | undefined;
}, {
    color?: string | undefined;
    canvasId?: string | number | undefined;
    xPos?: number | null | undefined;
    yPos?: number | null | undefined;
}>;
export declare const placePixelSchema: z.ZodObject<{
    params: z.ZodArray<z.ZodObject<{
        canvasId: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>>;
        xPos: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        yPos: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        color: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        color: string;
        canvasId: string | number;
        xPos?: number | null | undefined;
        yPos?: number | null | undefined;
    }, {
        color?: string | undefined;
        canvasId?: string | number | undefined;
        xPos?: number | null | undefined;
        yPos?: number | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    params: {
        color: string;
        canvasId: string | number;
        xPos?: number | null | undefined;
        yPos?: number | null | undefined;
    }[];
}, {
    params: {
        color?: string | undefined;
        canvasId?: string | number | undefined;
        xPos?: number | null | undefined;
        yPos?: number | null | undefined;
    }[];
}>;
export type placePixelParam = z.infer<typeof placePixelParamSchema>;
