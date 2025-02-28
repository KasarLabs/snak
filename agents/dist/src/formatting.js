"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSection = exports.createBox = exports.formatJsonContent = exports.wrapText = exports.getTerminalWidth = void 0;
const chalk_1 = __importDefault(require("chalk"));
const getTerminalWidth = () => {
    return Math.min(process.stdout.columns || 80, 100);
};
exports.getTerminalWidth = getTerminalWidth;
const wrapText = (text, maxWidth) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    words.forEach((word) => {
        if ((currentLine + ' ' + word).length <= maxWidth) {
            currentLine += (currentLine ? ' ' : '') + word;
        }
        else {
            if (currentLine)
                lines.push(currentLine);
            currentLine = word;
        }
    });
    if (currentLine)
        lines.push(currentLine);
    return lines;
};
exports.wrapText = wrapText;
const formatJsonContent = (content) => {
    try {
        const obj = typeof content === 'string' ? JSON.parse(content) : content;
        return JSON.stringify(obj, null, 2).split('\n');
    }
    catch {
        return Array.isArray(content) ? content : [String(content)];
    }
};
exports.formatJsonContent = formatJsonContent;
const createBox = (title, content, options = {}) => {
    const { isError = false } = options;
    const color = isError ? chalk_1.default.red : chalk_1.default.cyan;
    const terminalWidth = (0, exports.getTerminalWidth)();
    const contentWidth = terminalWidth - 6;
    const horizontalLine = '─'.repeat(terminalWidth - 2);
    let result = '\n';
    result += color(`╭${horizontalLine}╮\n`);
    result +=
        color('│') +
            chalk_1.default.yellow(` ${title}`.padEnd(terminalWidth - 2)) +
            color('│\n');
    result += color(`├${horizontalLine}┤\n`);
    let lines;
    if (Array.isArray(content)) {
        lines = content;
    }
    else {
        lines = (0, exports.formatJsonContent)(content);
    }
    lines.forEach((line) => {
        const wrappedLines = (0, exports.wrapText)(line, contentWidth);
        wrappedLines.forEach((wrappedLine) => {
            result +=
                color('│') +
                    chalk_1.default.white(` ${wrappedLine}`.padEnd(terminalWidth - 2)) +
                    color('│\n');
        });
    });
    result += color(`╰${horizontalLine}╯\n`);
    return result;
};
exports.createBox = createBox;
const formatSection = (items) => {
    return items.map((item) => `  • ${item.trim()}`);
};
exports.formatSection = formatSection;
//# sourceMappingURL=formatting.js.map