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

class Metrics {
  private agentCountActive?: client.Gauge;
  private agentCountTotal?: client.Counter;
  private agentResponseTime?: client.Histogram;
  private dbQueryTime?: client.Histogram;
  private agentToolUseCounter = new Map<string, client.Counter>();

  private userAgentActive?: client.Gauge;
  private userAgentTotal?: client.Counter;
  private userPromptTokens?: client.Counter;
  private userCompletionTokens?: client.Counter;
  private userTotalTokens?: client.Counter;

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

    // client.collectDefaultMetrics({ prefix: 'snak_' });

    this.agentCountActive = new client.Gauge({
      name: 'agent_count_active',
      help: 'Number of currently active agents',
      labelNames: ['agent', 'mode'] as const,
    });

    this.agentCountTotal = new client.Counter({
      name: 'agent_count_total',
      help: 'Number of agents created since server start',
      labelNames: ['agent', 'mode'] as const,
    });

    this.agentResponseTime = new client.Histogram({
      name: 'agent_response_time_seconds',
      help: 'Time agents take to response to API requests, in seconds',
      labelNames: ['agent', 'mode', 'route'] as const,
      buckets: [0.5, 1, 2, 5, 10, 15, 30, 60, 120],
    });

    this.dbQueryTime = new client.Histogram({
      name: 'db_response_time_seconds',
      help: 'Time the database takes to respond to queries, in seconds',
      labelNames: ['query'] as const,
      buckets: [0.5, 1, 2, 5, 10, 15, 30, 60, 120],
    });

    this.userAgentActive = new client.Gauge({
      name: 'user_agent_active',
      help: 'Number of active agents per user',
      labelNames: ['user', 'agent', 'mode'] as const,
    });

    this.userAgentTotal = new client.Counter({
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
    const end = this.agentResponseTime!.startTimer();
    const res = await f;
    end({ agent, mode, route });
    return res;
  }

  public agentConnect(agent: string, mode: string): void {
    if (!this.agentCountActive) this.register();
    this.agentCountActive!.labels({ agent, mode }).inc();
    this.agentCountTotal!.labels({ agent, mode }).inc();
  }

  public agentDisconnect(agent: string, mode: string): void {
    if (!this.agentCountActive) this.register();
    this.agentCountActive!.labels({ agent, mode }).dec();
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

  public async dbResponseTime<T>(query: string, f: () => Promise<T>): Promise<T> {
    if (!this.dbQueryTime) this.register();
    const end = this.dbQueryTime!.startTimer();
    const res = await f();
    end({ query });
    return res;
  }

  public userAgentConnect(user: string, agent: string, mode: string): void {
    if (!this.userAgentActive) this.register();
    this.userAgentActive!.labels({ user, agent, mode }).inc();
    this.userAgentTotal!.labels({ user, agent, mode }).inc();
  }

  public userAgentDisconnect(user: string, agent: string, mode: string): void {
    if (!this.userAgentActive) this.register();
    this.userAgentActive!.labels({ user, agent, mode }).dec();
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
    this.userTotalTokens!
      .labels({ user, agent })
      .inc(promptTokens + completionTokens);
  }
}

const metrics = new Metrics();
export default metrics;
export { metrics };