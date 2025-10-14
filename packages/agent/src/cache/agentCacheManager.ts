import { logger } from '@snakagent/core';

import { BaseAgent } from '../agents/core/baseAgent.js';

type CacheInitializer = () => Promise<BaseAgent>;

interface CacheConfig {
  maxCachedAgents?: number;
  maxCachedAgentsPerUser?: number;
}

interface CacheEntry {
  agentId: string;
  userId: string;
  createdAt: number;
  lastUsed: number;
  agent?: BaseAgent;
  pending?: Promise<BaseAgent>;
}

/**
 * Shared cache for agent instances with basic LRU eviction.
 *
 * The manager keeps a single instance of each agent per process and
 * enforces global/per-user limits. Invalidation disposes the agent
 * immediately so the next access rebuilds a fresh instance.
 */
export class AgentCacheManager {
  private static instance: AgentCacheManager | null = null;

  private config: Required<CacheConfig> = {
    maxCachedAgents: Number.POSITIVE_INFINITY, // TODO setup a guard for this
    maxCachedAgentsPerUser: Number.POSITIVE_INFINITY, // TODO setup a guard for this
  };

  private readonly globalCache = new Map<string, CacheEntry>();
  private readonly perUserCache = new Map<string, Map<string, CacheEntry>>();

  private constructor() {}

  public static getInstance(): AgentCacheManager {
    if (!AgentCacheManager.instance) {
      AgentCacheManager.instance = new AgentCacheManager();
    }
    return AgentCacheManager.instance;
  }

  /**
   * Configure cache limits. Values <= 0 are treated as zero.
   */
  public configure(config: CacheConfig): void {
    if (typeof config.maxCachedAgents === 'number') {
      this.config.maxCachedAgents =
        config.maxCachedAgents > 0
          ? config.maxCachedAgents
          : config.maxCachedAgents === 0
            ? 0
            : Number.POSITIVE_INFINITY;
    }
    if (typeof config.maxCachedAgentsPerUser === 'number') {
      this.config.maxCachedAgentsPerUser =
        config.maxCachedAgentsPerUser > 0
          ? config.maxCachedAgentsPerUser
          : config.maxCachedAgentsPerUser === 0
            ? 0
            : Number.POSITIVE_INFINITY;
    }
  }

  /**
   * Retrieve an agent from the cache or build it with the provided initializer.
   * This method guarantees that only one initializer runs per agent at a time.
   */
  public async getOrCreate(
    userId: string,
    agentId: string,
    initializer: CacheInitializer
  ): Promise<BaseAgent> {
    const cacheKey = this.makeKey(userId, agentId);
    const existing = this.globalCache.get(cacheKey);

    if (existing?.agent) {
      this.touchEntry(existing);
      return existing.agent;
    }

    if (existing?.pending) {
      this.touchEntry(existing);
      return existing.pending;
    }

    const pending = this.createPendingEntry(userId, agentId, initializer);
    this.touchEntry(pending);
    return pending.pending!;
  }

  /**
   * Return an agent only if it is already cached.
   */
  public get(userId: string, agentId: string): BaseAgent | undefined {
    const cacheKey = this.makeKey(userId, agentId);
    const existing = this.globalCache.get(cacheKey);
    if (!existing?.agent) {
      return undefined;
    }
    this.touchEntry(existing);
    return existing.agent;
  }

  /**
   * Store an agent in the cache and enforce limits.
   */
  public async put(userId: string, agentId: string, agent: BaseAgent) {
    const entry = this.createResolvedEntry(userId, agentId, agent);
    this.touchEntry(entry);
    await this.enforceLimits(userId);
  }

  /**
   * Dispose and remove a cached agent.
   */
  public async invalidate(userId: string, agentId: string): Promise<void> {
    const cacheKey = this.makeKey(userId, agentId);
    const entry = this.globalCache.get(cacheKey);
    if (!entry) {
      return;
    }

    this.globalCache.delete(cacheKey);
    const userMap = this.perUserCache.get(userId);
    userMap?.delete(agentId);

    try {
      const agent =
        entry.agent ??
        (entry.pending
          ? await entry.pending.catch(() => undefined)
          : undefined);
      if (agent) {
        await agent.dispose();
        logger.debug(
          `[AgentCache] Disposed agent ${agentId} for user ${userId} on invalidate`
        );
      }
    } catch (error) {
      logger.warn(
        `[AgentCache] Error while disposing agent ${agentId}: ${error}`
      );
    }
  }

  /**
   * Clear the whole cache and dispose all agents.
   */
  public async clear(): Promise<void> {
    const entries = Array.from(this.globalCache.values());
    this.globalCache.clear();
    this.perUserCache.clear();

    await Promise.all(
      entries.map(async (entry) => {
        try {
          const agent =
            entry.agent ??
            (entry.pending
              ? await entry.pending.catch(() => undefined)
              : undefined);
          if (agent) {
            await agent.dispose();
          }
        } catch (error) {
          logger.warn(
            `[AgentCache] Error while disposing agent ${entry.agentId} during clear: ${error}`
          );
        }
      })
    );
  }

  public size(): number {
    return this.globalCache.size;
  }

  private createPendingEntry(
    userId: string,
    agentId: string,
    initializer: CacheInitializer
  ): CacheEntry {
    const cacheKey = this.makeKey(userId, agentId);
    const now = Date.now();
    const entry: CacheEntry = {
      agentId,
      userId,
      createdAt: now,
      lastUsed: now,
    };

    entry.pending = initializer()
      .then((agent) => {
        entry.agent = agent;
        entry.pending = undefined;
        entry.lastUsed = Date.now();
        logger.debug(`[AgentCache] Cached agent ${agentId} for user ${userId}`);
        return agent;
      })
      .catch((error) => {
        // Remove entry on failure so a subsequent call can retry.
        this.globalCache.delete(cacheKey);
        const userMap = this.perUserCache.get(userId);
        userMap?.delete(agentId);
        throw error;
      })
      .finally(async () => {
        // Make sure limits are enforced once the agent is ready (or failed).
        await this.enforceLimits(userId);
      });

    this.globalCache.set(cacheKey, entry);
    this.getOrCreateUserMap(userId).set(agentId, entry);
    return entry;
  }

  private createResolvedEntry(
    userId: string,
    agentId: string,
    agent: BaseAgent
  ): CacheEntry {
    const cacheKey = this.makeKey(userId, agentId);
    const entry: CacheEntry = {
      agentId,
      userId,
      agent,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };
    this.globalCache.set(cacheKey, entry);
    this.getOrCreateUserMap(userId).set(agentId, entry);
    return entry;
  }

  private getOrCreateUserMap(userId: string): Map<string, CacheEntry> {
    let userMap = this.perUserCache.get(userId);
    if (!userMap) {
      userMap = new Map<string, CacheEntry>();
      this.perUserCache.set(userId, userMap);
    }
    return userMap;
  }

  private touchEntry(entry: CacheEntry): void {
    const cacheKey = this.makeKey(entry.userId, entry.agentId);
    entry.lastUsed = Date.now();

    // Maintain LRU order by re-inserting.
    this.globalCache.delete(cacheKey);
    this.globalCache.set(cacheKey, entry);

    const userMap = this.getOrCreateUserMap(entry.userId);
    userMap.delete(entry.agentId);
    userMap.set(entry.agentId, entry);
  }

  private async enforceLimits(userId: string): Promise<void> {
    const disposals: Promise<void>[] = [];

    const userLimit = this.config.maxCachedAgentsPerUser;
    if (
      Number.isFinite(userLimit) &&
      userLimit >= 0 &&
      userLimit < Number.POSITIVE_INFINITY
    ) {
      const userMap = this.perUserCache.get(userId);
      while (userMap && userMap.size > userLimit) {
        const leastUsedAgentId = userMap.keys().next().value;
        if (!leastUsedAgentId) {
          break;
        }
        const entry = userMap.get(leastUsedAgentId);
        userMap.delete(leastUsedAgentId);
        if (!entry) {
          continue;
        }
        disposals.push(
          this.evictEntry(entry, 'per-user limit reached').catch(() => {})
        );
      }
    }

    const globalLimit = this.config.maxCachedAgents;
    while (
      Number.isFinite(globalLimit) &&
      globalLimit >= 0 &&
      globalLimit < Number.POSITIVE_INFINITY &&
      this.globalCache.size > globalLimit
    ) {
      const oldestKey = this.globalCache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      const entry = this.globalCache.get(oldestKey);
      this.globalCache.delete(oldestKey);
      if (!entry) {
        continue;
      }
      const userMap = this.perUserCache.get(entry.userId);
      userMap?.delete(entry.agentId);
      disposals.push(
        this.evictEntry(entry, 'global limit reached').catch(() => {})
      );
    }

    await Promise.all(disposals);
  }

  private async evictEntry(entry: CacheEntry, reason: string): Promise<void> {
    this.globalCache.delete(this.makeKey(entry.userId, entry.agentId));
    const userMap = this.perUserCache.get(entry.userId);
    userMap?.delete(entry.agentId);

    try {
      const agent =
        entry.agent ??
        (entry.pending
          ? await entry.pending.catch(() => undefined)
          : undefined);
      if (agent) {
        await agent.dispose();
        logger.debug(
          `[AgentCache] Disposed agent ${entry.agentId} for user ${entry.userId} (${reason})`
        );
      }
    } catch (error) {
      logger.warn(
        `[AgentCache] Error disposing agent ${entry.agentId} (${reason}): ${error}`
      );
    }
  }

  private makeKey(userId: string, agentId: string): string {
    return `${userId}:${agentId}`;
  }
}

export const agentCacheManager = AgentCacheManager.getInstance();
