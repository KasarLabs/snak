import { NotFoundException } from '@nestjs/common';
import path from 'path';
import { promises as fs } from 'fs';

export const test = () => {};
export const getFilename = async (filename: string): Promise<string> => {
  const { name, ext } = path.parse(filename);

  const dirPath = process.env.PATH_UPLOAD_DIR;
  if (!dirPath) throw new Error(`PATH_UPLOAD_DIR must be defined in .env file`);

  const secret = process.env.SECRET_PHRASE;
  let filePath;
  if (!secret) {
    filePath = `${dirPath}${filename}`;
  } else {
    const hash = await createHash(`${name}${secret}`);
    filePath = `${dirPath}${hash}${ext}`;
  }

  const normalizedPath = filePath.normalize();

  try {
    await fs.access(normalizedPath);
  } catch {
    throw new NotFoundException(`File not found : ${filePath}`);
  }

  return filePath;
};

const createHash = async (text: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};
