import chalk from 'chalk';

export const getTerminalWidth = (): number => {
  return Math.min(process.stdout.columns || 80, 100);
};

export const wrapText = (text: string, maxWidth: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    if ((currentLine + ' ' + word).length <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
};

export const formatJsonContent = (content: unknown): string[] => {
  try {
    const obj = typeof content === 'string' ? JSON.parse(content) : content;
    return JSON.stringify(obj, null, 2).split('\n');
  } catch {
    return Array.isArray(content) ? content : [String(content)];
  }
};

export const createBox = (
  title: string,
  content: string | string[] | unknown,
  options: { isError?: boolean } = {}
): string => {
  const { isError = false } = options;
  const color = isError ? chalk.red : chalk.cyan;
  const terminalWidth = getTerminalWidth();
  const contentWidth = terminalWidth - 6;

  const makeHorizontalLine = (length: number): string => {
    return Array(length).fill('─').join('');
  };

  const horizontalLine = makeHorizontalLine(terminalWidth - 2);

  let result = '\n';

  // Top border
  result += color('┌' + horizontalLine + '┐\n');

  // Title section
  result +=
    color('│') +
    chalk.yellow(' ' + title.padEnd(terminalWidth - 3)) +
    color('│\n');

  // Title separator
  result += color('├' + horizontalLine + '┤\n');

  // Content section
  let lines: string[];
  if (Array.isArray(content)) {
    lines = content;
  } else {
    lines = formatJsonContent(content);
  }

  lines.forEach((line) => {
    const wrappedLines = wrapText(line, contentWidth);
    wrappedLines.forEach((wrappedLine) => {
      result +=
        color('│') +
        chalk.white(' ' + wrappedLine.padEnd(terminalWidth - 3)) +
        color('│\n');
    });
  });

  // Bottom border
  result += color('└' + horizontalLine + '┘\n');

  return result;
};

export const formatSection = (items: string[]): string[] => {
  return items.map((item) => item.trim());
};
