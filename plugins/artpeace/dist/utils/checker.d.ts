export declare class Checker {
    private param;
    private world;
    private colors;
    private hexColors;
    constructor(param: string | number);
    checkWorld(): Promise<number>;
    checkPosition(x: number, y: number): Promise<number>;
    getColors(): Promise<void>;
    checkColor(color: string): Promise<string>;
    getWorldSize(): {
        width: number;
        height: number;
    };
}
