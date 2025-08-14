const truncateStringContentHelper = (
  content: string,
  maxLength: number
): string => {
  const originalLength = content.length;
  if (originalLength > maxLength) {
    return (
      content.substring(0, maxLength) +
      `... [truncated ${originalLength - maxLength} characters]`
    );
  }
  return content;
};

const parseJSONContent = (content: string): unknown | null => {
  const trimmedContent = content.trim();
  if (
    (trimmedContent.startsWith('[') && trimmedContent.endsWith(']')) ||
    (trimmedContent.startsWith('{') && trimmedContent.endsWith('}'))
  ) {
    try {
      return JSON.parse(trimmedContent);
    } catch (e) {
      return null;
    }
  }
  return null;
};

const processStringContent = (content: string): string => {
  const parsed = parseJSONContent(content);
  if (parsed !== null) {
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'type' in parsed &&
      'text' in parsed
    ) {
      const typedParsed = parsed as { type: string; text: string };
      if (typedParsed.type === 'text' && typedParsed.text) {
        return typedParsed.text;
      }
    }
    return JSON.stringify(parsed);
  }
  return content;
};

const processArrayContent = (content: unknown[]): string => {
  let result = '';
  for (const item of content) {
    if (typeof item === 'object' && item !== null) {
      if (
        'type' in item &&
        'text' in item &&
        typeof (item as any).type === 'string' &&
        typeof (item as any).text === 'string'
      ) {
        const typedItem = item as { type: string; text: string };
        if (typedItem.type === 'text' && typedItem.text) {
          result += typedItem.text + '\n';
        }
      } else if (
        'content' in item &&
        typeof (item as any).content === 'string'
      ) {
        const typedItem = item as { content: string };
        result += typedItem.content + '\n';
      } else {
        result += JSON.stringify(item) + '\n';
      }
    } else if (item !== null) {
      result += String(item) + '\n';
    }
  }
  return result.trim();
};

const processObjectContent = (content: Record<string, unknown>): string => {
  if (
    'type' in content &&
    'text' in content &&
    typeof content.type === 'string' &&
    typeof content.text === 'string'
  ) {
    if (content.type === 'text' && content.text) {
      return content.text;
    }
  } else if ('content' in content && typeof content.content === 'string') {
    return content.content;
  }
  return JSON.stringify(content);
};

const processMessageContent = (content: unknown): string => {
  if (typeof content === 'string') {
    const parsed = parseJSONContent(content);
    if (parsed !== null) {
      return processMessageContent(parsed);
    }
    return content;
  }

  if (Array.isArray(content)) {
    return processArrayContent(content);
  }

  if (typeof content === 'object' && content !== null) {
    return processObjectContent(content as Record<string, unknown>);
  }

  return String(content);
};

describe('utility functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('string processing', () => {
    it('should truncate long strings', () => {
      const longContent = 'a'.repeat(6000);
      const maxLength = 5000;

      const result = truncateStringContentHelper(longContent, maxLength);

      expect(result).toContain('... [truncated');
      expect(result.length).toBeLessThan(6000);
    });

    it('should not truncate short strings', () => {
      const shortContent = 'short content';
      const maxLength = 5000;

      const result = truncateStringContentHelper(shortContent, maxLength);

      expect(result).toBe(shortContent);
    });
  });

  describe('JSON processing', () => {
    it('should parse valid JSON strings', () => {
      const jsonString = '{"type": "text", "text": "JSON content"}';

      const result = processStringContent(jsonString);
      expect(result).toBe('JSON content');
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"invalid": json}';

      const result = processStringContent(malformedJson);
      expect(result).toBe(malformedJson);
    });
  });

  describe('array processing', () => {
    it('should process array with text objects', () => {
      const content = [
        { type: 'text', text: 'First item' },
        { type: 'text', text: 'Second item' },
      ];

      const result = processArrayContent(content);
      expect(result).toBe('First item\nSecond item');
    });

    it('should handle mixed content types', () => {
      const content = [
        { type: 'text', text: 'Text item' },
        { content: 'Content item' },
        'String item',
        { unknown: 'object' },
      ];

      const result = processArrayContent(content);
      expect(result).toBe(
        'Text item\nContent item\nString item\n{"unknown":"object"}'
      );
    });
  });

  describe('object processing', () => {
    it('should process text type object', () => {
      const content = { type: 'text', text: 'Text content' };

      const result = processObjectContent(content);
      expect(result).toBe('Text content');
    });

    it('should process content object', () => {
      const content = { content: 'Object content' };

      const result = processObjectContent(content);
      expect(result).toBe('Object content');
    });

    it('should stringify unknown object', () => {
      const content = { key: 'value', number: 123 };

      const result = processObjectContent(content);
      expect(result).toBe('{"key":"value","number":123}');
    });
  });

  describe('message content processing', () => {
    it('should process string content', () => {
      const content = '{"type": "text", "text": "String content"}';

      const result = processMessageContent(content);
      expect(result).toBe('String content');
    });

    it('should process array content', () => {
      const content = [
        { type: 'text', text: 'Array item 1' },
        { type: 'text', text: 'Array item 2' },
      ];

      const result = processMessageContent(content);
      expect(result).toBe('Array item 1\nArray item 2');
    });

    it('should handle primitive types', () => {
      expect(processMessageContent(123)).toBe('123');
      expect(processMessageContent(true)).toBe('true');
      expect(processMessageContent(null)).toBe('null');
    });
  });
});
