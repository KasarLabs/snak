export declare class ColorAnalyzer {
    private static LIGHT_THRESHOLD;
    private static DARK_THRESHOLD;
    private static WHITE_THRESHOLD;
    private static BLACK_THRESHOLD;
    private static GRAY_DIFFERENCE_THRESHOLD;
    private static SATURATION_THRESHOLD;
    static analyzeColor(hex: string): string;
    private static isGray;
    private static isWhite;
    private static isBlack;
    private static hexToRgb;
    private static rgbToHsv;
    private static getBaseColor;
}
