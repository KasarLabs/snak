/**
 * Registers and updates [prometheus] metrics with [prom-client].
 *
 * Metrics are exposed under {@see ./src/metrics.controller.ts} as
 * `api/metrics`. To access metrics, you can use:
 *
 * ```bash
 * curl -H "x-api-key:test" -GET localhost:3000/api/metrics
 * ```
 *
 * > [!TIP]
 * > You might need to update the above command to reflect the configuration
 * > options you set in your `.env`.
 *
 * [prometheus]: (https://prometheus.io/docs/introduction/overview/)
 * [prom-client]: (https://github.com/siimon/prom-client)
 *
 * @module metrics
 * @packageDocumentation
 */

import client from 'prom-client';

const register = new client.Registry();
export const contentType = register.contentType;

client.collectDefaultMetrics({ prefix: 'sank_', register });

/**
 * Get the latest app metrics.
 *
 * @returns Plaintext prometheus metrics.
 */
export async function metrics(): Promise<string> {
  return await register.metrics();
}

// ========================================================================== //
// ...............................AGENT METRICS.............................. //
// ========================================================================== //

const agentCountActive = new client.Gauge({
  name: 'agent_count_active',
  help: 'Number of currently active agents',
  labelNames: ['agent', 'mode'] as const,
});
register.registerMetric(agentCountActive);

const agentCountTotal = new client.Counter({
  name: 'agent_count_total',
  help: 'Number of agents created since server start',
  labelNames: ['agent', 'mode'] as const,
});
register.registerMetric(agentCountTotal);

const agentResponseTime = new client.Histogram({
  name: 'agent_response_time_seconds',
  help: 'Time agents take to response to API requests, in seconds',
  labelNames: ['agent', 'mode', 'route'] as const,
  buckets: [0.5, 1, 2, 5, 10, 15, 30, 60, 120],
});
register.registerMetric(agentResponseTime);

const agentToolUseCounter = new Map<string, client.Counter>();

/**
 * Measures the time it takes an agent to perform an action and adds it to the
 * global metrics.
 *
 * @template T - Return type of the timed promise.
 * @param agent - Agent being monitored.
 * @param mode - Agent mode, `agent` or `auto`.
 * @param route - Api route we are timing.
 * @param f - Future to time.
 * @returns - Result of `await f`;
 * @see metrics
 */
export async function metricsAgentResponseTime<T>(
  agent: string,
  mode: string,
  route: string,
  f: Promise<T>
): Promise<T> {
  const end = agentResponseTime.startTimer();
  const res = await f;
  end({ agent, mode, route });
  return res;
}

/**
 * Keeps track of the total number of active agents
 *
 * @param agent - Agent being monitored.
 * @param mode - Agent mode, `agent` or `auto`.
 * @see metrics
 * @see metricsAgentCountActiveDisconnet
 */
export function metricsAgentCountActiveConnect(agent: string, mode: string) {
  agentCountActive.labels({ agent, mode }).inc();
  agentCountTotal.labels({ agent, mode }).inc();
}

// TODO: need graceful shutdown
/**
 * Marks an agent as having shut down.
 *
 * @param agent - Agent being monitored.
 * @param mode - Agent mode, `agent` or `auto`.
 * @see metrics
 * @see metricsAgentCountActiveConnect
 */
export function metricsAgentCountActiveDisconnet(agent: string, mode: string) {
  agentCountActive.labels({ agent, mode }).dec();
}

/**
 * Keeps track of how many times a tool is added to an agent.
 *
 * > [!NOTE]
 * > Counters for new tools are created lazily as they are added, so a tool will
 * > never have a counter of 0, it will just have no counter. If you do not see
 * > a tool appear in the metrics, that means it has not been added to an agent
 * > yet.
 *
 * @param agent - Agent being monitored.
 * @param mode - Agent mode, `agent` or `auto`.
 * @param tool - Tool being monitored.
 * @see metrics
 */
export function metricsAgentToolUseCount(
  agent: string,
  mode: string,
  tool: string
) {
  const counter =
    agentToolUseCounter.get(tool) ||
    (() => {
      const counterNew = new client.Counter({
        name: `tool_${tool}_use_counter`,
        help: 'Number of times an agent uses this tool',
        labelNames: ['agent', 'mode'] as const,
      });

      register.registerMetric(counterNew);
      agentToolUseCounter.set(tool, counterNew);

      return counterNew;
    })();

  counter.labels({ agent, mode }).inc();
}

// ========================================================================== //
// .............................DATABASE METRICS............................. //
// ========================================================================== //

// TODO:not implementing this until db refactor
const DbQueryTime = new client.Histogram({
  name: 'db_response_time_seconds',
  help: 'Time the database takes to respond to queries, in seconds',
  labelNames: ['query'] as const,
  buckets: [0.5, 1, 2, 5, 10, 15, 30, 60, 120],
});
register.registerMetric(DbQueryTime);

const DbCountError = new client.Counter({
  name: 'db_count_error',
  help: 'Number of database-related errors since server startup',
  labelNames: ['query'] as const,
});
register.registerMetric(DbCountError);

const DbCountConnections = new client.Counter({
  name: 'db_count_connections',
  help: 'Number of active database connections',
});
register.registerMetric(DbCountConnections);

export async function metricsDbResponseTime<T>(
  query: string,
  f: () => Promise<T>
) {
  const end = DbQueryTime.startTimer();
  const res = await f();
  end({ query });
  res;
}
