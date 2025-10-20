/**
 * @module metrics
 * @packageDocumentation
 *
 * Registers and updates Prometheus metrics via [prom-client].
 *
 * Metrics endpoint exposed on /metrics (ex. curl -H "x-api-key:test" -GET localhost:3002/api/metrics).
 *
 * [prometheus]: https://prometheus.io/docs/introduction/overview/
 * [prom-client]: https://github.com/siimon/prom-client
 */

import client from 'prom-client';

/**
 * Singleton class managing Prometheus metrics.
 */

const DEFAULT_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30,
  60, 120,
];

class Metrics {
  /**
   * Agent metrics
   */
  private agentCountActive?: client.Gauge;
  private agentCountTotal?: client.Counter; // more for debugging, and to know how many agents were created
  private agentResponseTime?: client.Histogram;
  private dbQueryTime?: client.Histogram;
  private agentToolUseCounter = new Map<string, client.Counter>();
  private agentMsgTotal = new Map<string, client.Counter>(); // total messages sent by 1 agent
  private agentPromptTokens?: client.Counter;
  private agentCompletionTokens?: client.Counter;
  private agentTotalTokens?: client.Counter;

  /**
   * User metrics, TODO: User Management incoming
   */
  private userAgentsActive?: client.Gauge;
  private userAgentsTotal?: client.Counter;
  private userPromptTokens?: client.Counter;
  private userCompletionTokens?: client.Counter;
  private userTotalTokens?: client.Counter;

  /**
   * Error metrics / or blackbox exporter ?
   */

  private errorCount = new Map<string, client.Counter>(); // total errors by type
  private agentCfgOutboxProcessed?: client.Counter;
  private agentCfgOutboxErrors?: client.Counter;
  private agentCfgOutboxRequeued?: client.Counter;
  private agentCfgCacheAccess?: client.Counter;
  private agentCfgCacheStore?: client.Counter;

  private registered = false;

  public get contentType() {
    return client.register.contentType;
  }

  /**
   * Return the dump text of Prometheus metrics.
   *
   * @returns Plaintext Prometheus format.
   */
  public async metrics(): Promise<string> {
    if (!this.registered) {
      this.register();
    }
    return client.register.metrics();
  }

  private register(): void {
    if (this.registered) return;
    this.registered = true;

    client.collectDefaultMetrics({ prefix: 'nodejs_' });

    this.agentCountActive = new client.Gauge({
      name: 'agent_count_active',
      help: 'Number of currently active agents',
    });

    this.agentCountTotal = new client.Counter({
      name: 'agent_count_total',
      help: 'Number of agents created since server start',
    });

    this.agentResponseTime = new client.Histogram({
      name: 'agent_response_time_seconds',
      help: 'Time agents take to response to API requests, in seconds',
      labelNames: ['agent', 'mode', 'route'] as const,
      buckets: DEFAULT_BUCKETS,
    });

    this.dbQueryTime = new client.Histogram({
      name: 'db_response_time_seconds',
      help: 'Time the database takes to respond to queries, in seconds',
      labelNames: ['query'] as const,
      buckets: DEFAULT_BUCKETS,
    });

    this.agentPromptTokens = new client.Counter({
      name: 'agent_prompt_tokens_total',
      help: 'Total prompt tokens used per agent',
      labelNames: ['agent'] as const,
    });

    this.agentCompletionTokens = new client.Counter({
      name: 'agent_completion_tokens_total',
      help: 'Total completion tokens generated per agent',
      labelNames: ['agent'] as const,
    });

    this.agentTotalTokens = new client.Counter({
      name: 'agent_tokens_total',
      help: 'Total tokens (prompt + completion) used per agent',
      labelNames: ['agent'] as const,
    });

    this.userAgentsActive = new client.Gauge({
      name: 'user_agent_active',
      help: 'Number of active agents per user',
      labelNames: ['user', 'agent', 'mode'] as const,
    });

    this.userAgentsTotal = new client.Counter({
      name: 'user_agent_total',
      help: 'Total number of agent sessions started per user',
      labelNames: ['user', 'agent', 'mode'] as const,
    });

    this.userPromptTokens = new client.Counter({
      name: 'user_prompt_tokens_total',
      help: 'Total prompt tokens used per user',
      labelNames: ['user', 'agent'] as const,
    });

    this.userCompletionTokens = new client.Counter({
      name: 'user_completion_tokens_total',
      help: 'Total completion tokens used per user',
      labelNames: ['user', 'agent'] as const,
    });

    this.userTotalTokens = new client.Counter({
      name: 'user_tokens_total',
      help: 'Total tokens (prompt + completion) used per user',
      labelNames: ['user', 'agent'] as const,
    });

    this.agentCfgOutboxProcessed = new client.Counter({
      name: 'agent_cfg_outbox_processed_total',
      help: 'Total outbox events successfully published to downstream systems',
      labelNames: ['event'] as const,
    });

    this.agentCfgOutboxErrors = new client.Counter({
      name: 'agent_cfg_outbox_errors_total',
      help: 'Total errors encountered while processing outbox events',
      labelNames: ['event'] as const,
    });

    this.agentCfgOutboxRequeued = new client.Counter({
      name: 'agent_cfg_outbox_requeued_total',
      help: 'Total outbox events requeued after downstream publication failures',
      labelNames: ['event'] as const,
    });

    this.agentCfgCacheAccess = new client.Counter({
      name: 'agent_cfg_cache_access_total',
      help: 'Total agent configuration cache access attempts',
      labelNames: ['outcome'] as const,
    });

    this.agentCfgCacheStore = new client.Counter({
      name: 'agent_cfg_cache_store_total',
      help: 'Total agent configuration cache store operations',
      labelNames: ['operation'] as const,
    });
  }

  public agentConnect(): void {
    if (!this.agentCountActive) this.register();
    this.agentCountActive!.inc();
    this.agentCountTotal!.inc();
  }

  public agentDisconnect(): void {
    if (!this.agentCountActive) this.register();
    this.agentCountActive!.dec();
  }

  /**
   * Measure the response time of an agent's API request.
   *
   * @param agent - Agent name
   * @param mode - Connection mode (e.g., 'web', 'mobile')
   * @param route - API route being accessed
   * @param f - Function that returns a Promise for the agent's response
   * @returns Result of the agent's response
   */
  public async agentResponseTimeMeasure<T>(
    agent: string,
    mode: string,
    route: string,
    f: Promise<T>
  ): Promise<T> {
    if (!this.agentResponseTime) this.register();
    const end = this.agentResponseTime!.startTimer({ agent, mode, route });
    const res = await f;
    end(); // count around minus 2secs
    return res;
  }

  /**
   * Measure the response time of async chunks.
   *
   * @param agent  - Agent ID
   * @param mode   - 'websocket' ...
   * @param route  - Route
   * @param genFn  - function that return AsyncGenerator<T>
   * @returns      Un AsyncGenerator<T> identique, en mesurant le temps jusqu’à la fin du flux.
   */

  public async *agentResponseTimeStream<T>(
    agent: string,
    mode: string,
    route: string,
    genFn: () => AsyncGenerator<T>
  ): AsyncGenerator<T> {
    if (!this.agentResponseTime) this.register();
    const end = this.agentResponseTime!.startTimer();
    try {
      for await (const chunk of genFn()) {
        yield chunk;
      }
    } finally {
      end({ agent, mode, route });
    }
  }

  /**
   * Measure the execution time of database request. Monitoring performance of database queries.
   *
   * @param query - Database query string
   * @param f - Function that returns a Promise for the database operation
   * @returns
   */
  public async dbResponseTime<T>(
    query: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.dbQueryTime) this.register();
    const end = this.dbQueryTime!.startTimer({ query });
    try {
      return await fn();
    } finally {
      end();
    }
  }

  public agentMsgCount(agent: string, mode: string, msgType: string): void {
    const counter =
      this.agentMsgTotal.get(msgType) ||
      (() => {
        const c = new client.Counter({
          name: `agent_${msgType}_messages_total`,
          help: 'Total messages sent by an agent',
          labelNames: ['agent', 'mode'] as const,
        });
        this.agentMsgTotal.set(msgType, c);
        return c;
      })();
    counter.labels({ agent, mode }).inc();
  }

  public agentToolUseCount(agent: string, mode: string, tool: string): void {
    if (!this.agentCountActive) this.register();
    const counter =
      this.agentToolUseCounter.get(tool) ||
      (() => {
        const c = new client.Counter({
          name: `tool_${tool}_use_counter`,
          help: 'Number of times an agent uses this tool',
          labelNames: ['agent', 'mode'] as const,
        });
        this.agentToolUseCounter.set(tool, c);
        return c;
      })();
    counter.labels({ agent, mode }).inc();
  }

  /**
   * Records token usage for an agent.
   * @param agent - Agent identifier
   * @param promptTokens - Number of prompt tokens used
   * @param completionTokens - Number of completion tokens generated
   */
  public recordAgentTokenUsage(
    agent: string,
    promptTokens: number,
    completionTokens: number
  ): void {
    if (!this.agentPromptTokens) this.register();
    this.agentPromptTokens!.labels(agent).inc(promptTokens);
    this.agentCompletionTokens!.labels(agent).inc(completionTokens);
    this.agentTotalTokens!.labels(agent).inc(promptTokens + completionTokens);
  }

  /**
   * Sets the number of active agents for a user.
   * @param user - User identifier
   * @param count - Number of active agents
   */

  public setUserActiveAgents(user: string, count: number): void {
    if (!this.userAgentsActive) this.register();
    this.userAgentsActive!.set({ user }, count);
  }

  public userAgentConnect(user: string, agent: string, mode: string): void {
    if (!this.userAgentsActive) this.register();
    this.userAgentsActive!.labels({ user, agent, mode }).inc();
    this.userAgentsTotal!.labels({ user, agent, mode }).inc();
  }

  public userAgentDisconnect(user: string, agent: string, mode: string): void {
    if (!this.userAgentsActive) this.register();
    this.userAgentsActive!.labels({ user, agent, mode }).dec();
  }

  public userTokenUsage(
    user: string,
    agent: string,
    promptTokens: number,
    completionTokens: number
  ): void {
    if (!this.userPromptTokens) this.register();
    this.userPromptTokens!.labels({ user, agent }).inc(promptTokens);
    this.userCompletionTokens!.labels({ user, agent }).inc(completionTokens);
    this.userTotalTokens!.labels({ user, agent }).inc(
      promptTokens + completionTokens
    );
  }

  public recordAgentCfgOutboxProcessed(count: number, event = 'cfg_updated'): void {
    if (!this.agentCfgOutboxProcessed) this.register();
    this.agentCfgOutboxProcessed!.labels({ event }).inc(count);
  }

  public recordAgentCfgOutboxError(event = 'cfg_updated'): void {
    if (!this.agentCfgOutboxErrors) this.register();
    this.agentCfgOutboxErrors!.labels({ event }).inc();
  }

  public recordAgentCfgOutboxRequeued(event = 'cfg_updated'): void {
    if (!this.agentCfgOutboxRequeued) this.register();
    this.agentCfgOutboxRequeued!.labels({ event }).inc();
  }

  public recordAgentCfgCacheAccess(outcome: 'hit' | 'miss' | 'stale' | 'error'): void {
    if (!this.agentCfgCacheAccess) this.register();
    this.agentCfgCacheAccess!.labels({ outcome }).inc();
  }

  public recordAgentCfgCacheStore(operation: 'refresh' | 'db_seed'): void {
    if (!this.agentCfgCacheStore) this.register();
    this.agentCfgCacheStore!.labels({ operation }).inc();
  }
}

const metrics = new Metrics();
export default metrics;
export { metrics };
