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
  options: { isError?: boolean; title?: string } = {}
): string => {
  const { isError = false } = options;
  const boxTitle = options.title || title;

  const color = isError ? chalk.red : chalk.cyan;
  const terminalWidth = getTerminalWidth();
  const contentWidth = terminalWidth - 6;

  const BOX_CHARS = {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    leftT: '├',
    rightT: '┤',
  };

  const makeHorizontalLine = (length: number): string => {
    return BOX_CHARS.horizontal.repeat(length);
  };

  const horizontalLine = makeHorizontalLine(terminalWidth - 2);

  let result = '\n';

  result += color(
    BOX_CHARS.topLeft + horizontalLine + BOX_CHARS.topRight + '\n'
  );

  result +=
    color(BOX_CHARS.vertical) +
    chalk.yellow(' ' + boxTitle.padEnd(terminalWidth - 3, ' ')) +
    color(BOX_CHARS.vertical + '\n');

  result += color(BOX_CHARS.leftT + horizontalLine + BOX_CHARS.rightT + '\n');

  let lines: string[];

  if (Array.isArray(content)) {
    lines = content
      .filter((line): line is string => line !== undefined && line !== null)
      .map((line) => String(line));
  } else if (typeof content === 'string') {
    lines = content.split('\n').filter((line) => line.trim() !== '');
  } else {
    try {
      const jsonLines = formatJsonContent(content);
      lines = jsonLines
        .filter((line): line is string => line !== undefined && line !== null)
        .map((line) => String(line));
    } catch (e) {
      lines = [String(content)];
    }
  }

  lines.forEach((line) => {
    const cleanLine = String(line);

    if (cleanLine.trim() === '') {
      result +=
        color(BOX_CHARS.vertical) +
        ' '.repeat(terminalWidth - 2) +
        color(BOX_CHARS.vertical + '\n');
      return;
    }

    const wrappedLines = wrapText(cleanLine, contentWidth);

    wrappedLines.forEach((wrappedLine) => {
      const innerWidth = terminalWidth - 4;

      const trimmedLine =
        wrappedLine.length > innerWidth
          ? wrappedLine.substring(0, innerWidth)
          : wrappedLine;

      const padding = ' '.repeat(innerWidth - trimmedLine.length);

      result +=
        color(BOX_CHARS.vertical) +
        ' ' +
        chalk.white(trimmedLine) +
        padding +
        color(' ' + BOX_CHARS.vertical + '\n');
    });
  });

  result += color(
    BOX_CHARS.bottomLeft + horizontalLine + BOX_CHARS.bottomRight + '\n'
  );

  return result;
};

export const formatSection = (items: string[]): string[] => {
  return items.map((item) => item.trim());
};
