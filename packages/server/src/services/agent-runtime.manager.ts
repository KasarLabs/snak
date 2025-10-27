import { Injectable, Logger } from '@nestjs/common';
import { getGuardValue, type AgentConfig } from '@snakagent/core';
import { BaseAgent } from '@snakagent/agents';

const parsePositiveInt = (
  value: string | undefined,
  fallback: number
): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const parseDurationMs = (fallback: number): number => {
  const ttlMsRaw = process.env.AGENT_RUNTIME_CACHE_TTL_MS;
  if (ttlMsRaw) {
    const parsed = Number.parseInt(ttlMsRaw, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  const ttlSecondsRaw = process.env.AGENT_RUNTIME_CACHE_TTL_SECONDS;
  if (ttlSecondsRaw) {
    const parsed = Number.parseInt(ttlSecondsRaw, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed * 1000;
    }
  }

  return fallback;
};

export interface AgentRuntimeSeed {
  agentId: string;
  userId: string;
  cfgVersion: number;
  runtime: AgentConfig.Runtime;
  agent?: BaseAgent;
  rebuild: () => Promise<AgentRuntimeSeed | null>;
  ttlMs?: number;
}

interface CacheEntry {
  agentId: string;
  userId: string;
  cfgVersion: number;
  runtime: AgentConfig.Runtime;
  agent?: BaseAgent;
  rebuild: () => Promise<AgentRuntimeSeed | null>;
  expiresAt: number;
  refCount: number;
  lastAccess: number;
}

@Injectable()
export class AgentRuntimeManager {
  private readonly logger = new Logger(AgentRuntimeManager.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<void>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor() {
    const guardMaxEntries = getGuardValue(
      'agent_runtime.cache.max_entries'
    ) as number;
    const guardMaxTtlMs = getGuardValue(
      'agent_runtime.cache.max_ttl_ms'
    ) as number;

    this.maxEntries = parsePositiveInt(
      process.env.AGENT_RUNTIME_CACHE_MAX_ENTRIES,
      guardMaxEntries
    );
    if (this.maxEntries > guardMaxEntries) {
      this.logger.warn(
        `AGENT_RUNTIME_CACHE_MAX_ENTRIES resolved to ${this.maxEntries}; capping to guard limit ${guardMaxEntries}`
      );
      this.maxEntries = guardMaxEntries;
    }

    const resolvedTtlMs = parseDurationMs(guardMaxTtlMs);
    if (resolvedTtlMs > guardMaxTtlMs) {
      this.logger.warn(
        `AGENT_RUNTIME_CACHE_TTL resolved to ${resolvedTtlMs}; capping to guard limit ${guardMaxTtlMs}`
      );
      this.defaultTtlMs = guardMaxTtlMs;
    } else {
      this.defaultTtlMs = resolvedTtlMs;
    }
  }

  /**
   * Shadow-mode registration used to prime the runtime cache without serving responses from it.
   * Records hit/miss metrics and updates the cached payload when necessary.
   */
  async shadowSeed(seed: AgentRuntimeSeed): Promise<void> {
    await this.withInflight(seed.agentId, async () => {
      const now = Date.now();
      this.pruneExpired(now);

      const existing = this.cache.get(seed.agentId);

      if (
        existing &&
        existing.cfgVersion === seed.cfgVersion &&
        !this.isExpired(existing, now)
      ) {
        existing.runtime = seed.runtime;
        existing.agent = seed.agent;
        existing.rebuild = seed.rebuild;
        existing.userId = seed.userId;
        existing.expiresAt = this.computeExpires(now, seed.ttlMs);
        existing.lastAccess = now;
        this.bump(seed.agentId, existing);
        return;
      }

      await this.installSeed(seed, now);
    });
  }

  /**
   * Acquire a runtime from cache, incrementing its reference count.
   */
  async acquire(agentId: string): Promise<AgentConfig.Runtime | null> {
    return this.withInflight(agentId, async () => this.doAcquire(agentId));
  }

  /**
   * Acquire both runtime and agent from cache, incrementing its reference count.
   */
  async acquireWithAgent(
    agentId: string
  ): Promise<{ runtime: AgentConfig.Runtime; agent?: BaseAgent } | null> {
    return this.withInflight(agentId, async () =>
      this.doAcquireWithAgent(agentId)
    );
  }

  private doAcquire(agentId: string): AgentConfig.Runtime | null {
    const now = Date.now();
    this.pruneExpired(now);

    const entry = this.cache.get(agentId);
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry, now)) {
      if (entry.refCount === 0) {
        this.cache.delete(agentId);
      }
      return null;
    }

    entry.refCount += 1;
    entry.lastAccess = now;
    this.bump(agentId, entry);
    return entry.runtime;
  }

  private doAcquireWithAgent(
    agentId: string
  ): { runtime: AgentConfig.Runtime; agent?: BaseAgent } | null {
    const now = Date.now();
    this.pruneExpired(now);

    const entry = this.cache.get(agentId);
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry, now)) {
      if (entry.refCount === 0) {
        this.cache.delete(agentId);
      }
      return null;
    }

    entry.refCount += 1;
    entry.lastAccess = now;
    this.bump(agentId, entry);
    return { runtime: entry.runtime, agent: entry.agent };
  }

  /**
   * Release a previously acquired runtime, decrementing its reference count.
   */
  release(agentId: string): void {
    const entry = this.cache.get(agentId);
    if (!entry) {
      return;
    }

    if (entry.refCount > 0) {
      entry.refCount -= 1;
    }

    if (entry.refCount === 0 && this.isExpired(entry, Date.now())) {
      this.cache.delete(agentId);
      void this.safeDispose(entry.agent);
    }
  }

  /**
   * Handle configuration invalidation by atomically rebuilding and swapping the cached runtime.
   */
  async onInvalidate(agentId: string, cfgVersion: number): Promise<void> {
    await this.withInflight(agentId, async () => {
      const entry = this.cache.get(agentId);

      if (!entry) {
        this.logger.debug(
          `No cached runtime to invalidate for agent ${agentId}`
        );
        return;
      }

      try {
        const rebuiltSeed = await entry.rebuild();
        if (!rebuiltSeed) {
          this.logger.warn(
            `Runtime rebuild returned null during invalidation for agent ${agentId}; evicting entry`
          );
          this.cache.delete(agentId);
          return;
        }

        if (rebuiltSeed.cfgVersion < cfgVersion) {
          this.logger.warn(
            `Rebuilt runtime version ${rebuiltSeed.cfgVersion} is older than invalidation version ${cfgVersion} for agent ${agentId}`
          );
        }

        await this.installSeed(rebuiltSeed);
      } catch (error) {
        this.logger.warn(
          `Failed to rebuild runtime during invalidation for agent ${agentId}`,
          { error }
        );
        throw error;
      }
    });
  }

  get size(): number {
    return this.cache.size;
  }

  private async withInflight<T>(
    agentId: string,
    op: () => Promise<T>
  ): Promise<T> {
    const pending = this.inflight.get(agentId);
    if (pending) {
      try {
        await pending;
      } catch (error) {
        this.logger.debug(
          `Previous cache operation failed for agent ${agentId}`,
          { error }
        );
      }
    }

    const task = op();
    const sealed = task.then(() => undefined).catch(() => undefined);

    this.inflight.set(agentId, sealed);

    try {
      return await task;
    } finally {
      const current = this.inflight.get(agentId);
      if (current === sealed) {
        this.inflight.delete(agentId);
      }
    }
  }

  private async installSeed(
    seed: AgentRuntimeSeed,
    now = Date.now()
  ): Promise<void> {
    const expiresAt = this.computeExpires(now, seed.ttlMs);
    const existing = this.cache.get(seed.agentId);
    if (existing) {
      const oldAgent = existing.agent;
      const wasPinned = existing.refCount > 0;
      existing.userId = seed.userId;
      existing.cfgVersion = seed.cfgVersion;
      existing.runtime = seed.runtime;
      existing.agent = seed.agent;
      existing.rebuild = seed.rebuild;
      existing.expiresAt = expiresAt;
      existing.lastAccess = now;
      this.bump(seed.agentId, existing);
      if (oldAgent && !wasPinned) {
        void this.safeDispose(oldAgent);
      }
    } else {
      const entry: CacheEntry = {
        agentId: seed.agentId,
        userId: seed.userId,
        cfgVersion: seed.cfgVersion,
        runtime: seed.runtime,
        agent: seed.agent,
        rebuild: seed.rebuild,
        expiresAt,
        refCount: 0,
        lastAccess: now,
      };
      this.bump(seed.agentId, entry);
      this.trimCache();
    }
  }

  private bump(agentId: string, entry: CacheEntry): void {
    this.cache.delete(agentId);
    this.cache.set(agentId, entry);
  }

  private pruneExpired(now: number): void {
    for (const [agentId, entry] of this.cache) {
      if (entry.refCount === 0 && this.isExpired(entry, now)) {
        this.cache.delete(agentId);
        void this.safeDispose(entry.agent);
      }
    }
  }

  private trimCache(): void {
    if (this.cache.size <= this.maxEntries) {
      return;
    }

    const removable: string[] = [];
    for (const [agentId, entry] of this.cache) {
      if (entry.refCount === 0) {
        removable.push(agentId);
      }
    }

    for (const agentId of removable) {
      if (this.cache.size <= this.maxEntries) {
        break;
      }
      const removed = this.cache.get(agentId);
      this.cache.delete(agentId);
      if (removed?.agent) {
        void this.safeDispose(removed.agent);
      }
    }

    if (this.cache.size > this.maxEntries) {
      this.logger.warn(
        `Agent runtime cache still above capacity (${this.cache.size}/${this.maxEntries}) due to pinned entries`
      );
    }
  }

  private isExpired(entry: CacheEntry, now: number): boolean {
    return entry.expiresAt <= now;
  }

  private computeExpires(now: number, ttlOverride?: number): number {
    const ttlMs = ttlOverride != null ? ttlOverride : this.defaultTtlMs;
    if (ttlMs <= 0) {
      return Number.MAX_SAFE_INTEGER;
    }
    return now + ttlMs;
  }

  private async safeDispose(agent?: BaseAgent): Promise<void> {
    try {
      if (agent && typeof agent.dispose === 'function') {
        await agent.dispose();
      }
    } catch (error) {
      this.logger.warn(`Failed to dispose agent`, { error });
    }
  }
}

export default AgentRuntimeManager;
