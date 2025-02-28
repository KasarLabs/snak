export declare const getTerminalWidth: () => number;
export declare const wrapText: (text: string, maxWidth: number) => string[];
export declare const formatJsonContent: (content: unknown) => string[];
export declare const createBox: (title: string, content: string | string[] | unknown, options?: {
    isError?: boolean;
}) => string;
export declare const formatSection: (items: string[]) => string[];
