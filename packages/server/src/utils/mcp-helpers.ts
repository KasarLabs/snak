import { BadRequestException } from '@nestjs/common';
import { logger } from '@snakagent/core';

/**
 * Extracts a flag value from an argument list.
 * Example: ['--key', '123'] → extractFlagValue('--key') = '123'
 */
export function extractFlagValue(
  args: string[] | string,
  flag: string
): string | null {
  const arr = Array.isArray(args) ? args : args.trim().split(/\s+/);
  const idx = arr.findIndex((t) => t === flag);
  if (idx === -1 || idx + 1 >= arr.length) return null;
  return arr[idx + 1];
}

/**
 * Updates or inserts a flag value in an argument list.
 * Example: updateFlagValue(['--key', 'old'], '--key', 'new') → ['--key', 'new']
 */
export function updateFlagValue(
  args: string[] | string,
  flag: string,
  newValue: string
): string[] {
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

/**
 * Normalizes and validates a raw MCP configuration object.
 * Ensures 'command', 'args', and 'env' fields exist and are consistent.
 */
export function normalizeRawMcpConfig(cfg: any): Record<string, any> {
  if (!cfg || typeof cfg !== 'object') {
    throw new BadRequestException('Invalid MCP config');
  }

  if (!cfg.command || typeof cfg.command !== 'string') {
    throw new BadRequestException('Invalid MCP config — missing "command"');
  }

  let args: string[] = [];
  if (Array.isArray(cfg.args)) args = cfg.args.map(String);
  else if (typeof cfg.args === 'string') args = cfg.args.trim().split(/\s+/);

  const env =
    cfg.env && typeof cfg.env === 'object'
      ? Object.fromEntries(
          Object.entries(cfg.env).map(([k, v]) => [
            k.toUpperCase().trim(),
            String(v ?? ''),
          ])
        )
      : {};

  const out: Record<string, any> = { command: cfg.command, args, env };

  for (const [k, v] of Object.entries(cfg)) {
    if (!['command', 'args', 'env'].includes(k)) out[k] = v;
  }

  if (!out.env) out.env = {};

  const argsStr = args.join(' ').toLowerCase();
  if (argsStr.includes('--key') && !('API_KEY' in out.env)) {
    out.env.API_KEY = '';
  }
  if (argsStr.includes('--profile') && !('PROFILE' in out.env)) {
    out.env.PROFILE = '';
  }

  return out;
}

/**
 * Returns a shallow copy of MCP server configs with the canonical
 * command → args → env property order for each entry.
 */
export function formatMcpServersForResponse(
  mcpServers: Record<string, any> | null | undefined
): Record<string, any> {
  if (!mcpServers || typeof mcpServers !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(mcpServers).map(([serverId, config]) => {
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return [serverId, config];
      }

      const { command, args, env, ...rest } = config as Record<string, any>;
      const ordered: Record<string, any> = {};

      if (command !== undefined) ordered.command = command;
      if (args !== undefined) ordered.args = args;
      if (env !== undefined) ordered.env = env;

      for (const [key, value] of Object.entries(rest)) {
        ordered[key] = value;
      }

      return [serverId, ordered];
    })
  );
}

/**
 * Fetches a manifest for a given MCP ID, supporting both Smithery and open registry.
 * Returns null if not available.
 */
export async function fetchSmitheryManifest(
  mcpId: string
): Promise<any | null> {
  const apiKey = process.env.SMITHERY_API_KEY || process.env.SMITHERY_TOKEN;
  const url = `https://registry.smithery.ai/servers/${encodeURIComponent(mcpId)}`;

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    else
      logger.warn('No SMITHERY_API_KEY found — fetching public manifest only');

    const res = await fetch(url, { headers });

    if (!res.ok) {
      logger.warn(`Manifest fetch failed (${res.status}) for ${mcpId}`);
      return null;
    }

    const manifest = await res.json();

    if (manifest?.environmentVariables?.length) {
      manifest.env = Object.fromEntries(
        manifest.environmentVariables.map((v: any) => [v.name, ''])
      );
    }

    if (!manifest.env) manifest.env = {};

    logger.debug(`Manifest successfully fetched for ${mcpId}`);
    return manifest;
  } catch (err: any) {
    logger.warn(`Manifest fetch error for ${mcpId}: ${err.message}`);
    return null;
  }
}
