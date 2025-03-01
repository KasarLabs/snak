/**
 * Validates if the given string content is a valid JSON.
 *
 * @param content - The string to be validated as JSON.
 * @returns A Promise that resolves to true if the content is valid JSON, false otherwise.
 */
export async function validateJson(content: string): Promise<boolean> {
  try {
    if (!content.startsWith('{') && !content.startsWith('[')) {
      return false;
    }

    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}
