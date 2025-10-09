import { BadRequestException } from '@nestjs/common';
import { logger } from '@snakagent/core';

export function extractFlagValue(args: string[] | string, flag: string): string | null {
  const arr = Array.isArray(args) ? args : args.trim().split(/\s+/);
  const idx = arr.findIndex((t) => t === flag);
  if (idx === -1 || idx + 1 >= arr.length) return null;
  return arr[idx + 1];
}

export function updateFlagValue(args: string[] | string, flag: string, newValue: string): string[] {
  const arr = Array.isArray(args) ? [...args] : args.trim().split(/\s+/);
  const idx = arr.findIndex((t) => t === flag);

  if (idx === -1) {
    arr.push(flag, newValue);
  } else if (idx + 1 < arr.length) {
    arr[idx + 1] = newValue;
  } else {
    arr.push(newValue);
  }

  return arr;
}

export function normalizeRawMcpConfig(cfg: any) {
  if (!cfg || typeof cfg !== 'object') throw new BadRequestException('Invalid MCP config');
  if (!cfg.command || typeof cfg.command !== 'string') {
    throw new BadRequestException('Invalid MCP config — missing "command"');
  }

  let args: string[] = [];
  if (Array.isArray(cfg.args)) args = cfg.args.map(String);
  else if (typeof cfg.args === 'string') args = cfg.args.trim().split(/\s+/);

  const env =
    cfg.env && typeof cfg.env === 'object'
      ? Object.fromEntries(Object.entries(cfg.env).map(([k, v]) => [k, String(v)]))
      : {};

  const out: any = { command: cfg.command, args, env };

  for (const [k, v] of Object.entries(cfg)) {
    if (!['command', 'args', 'env'].includes(k)) out[k] = v;
  }

  return out;
}

export async function fetchSmitheryManifest(mcpId: string): Promise<any | null> {
  try {
    const apiKey = process.env.SMITHERY_API_KEY || process.env.SMITHERY_TOKEN;
    if (!apiKey) {
      logger.warn('No SMITHERY_API_KEY in env — skipping manifest fetch');
      return null;
    }

    const url = `https://registry.smithery.ai/servers/${encodeURIComponent(mcpId)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      logger.warn(`Smithery manifest fetch failed (${res.status}) for ${mcpId}`);
      return null;
    }

    const manifest = await res.json();
    logger.debug(`Smithery manifest fetched for ${mcpId}`);
    return manifest;
  } catch (err: any) {
    logger.warn(`Smithery manifest fetch error for ${mcpId}: ${err.message}`);
    return null;
  }
}
