import client from 'prom-client';

const register = new client.Registry();
export const contentType = register.contentType;

client.collectDefaultMetrics({ prefix: 'sank_', register });

export async function metrics(): Promise<string> {
  return await register.metrics();
}

// ========================================================================== //
// ...............................AGENT METRICS.............................. //
// ========================================================================== //

const agentCountActive = new client.Gauge({
  name: 'agent_count_active',
  help: 'Number of currently active agents',
  labelNames: ['agent', 'mode'] as const
});
register.registerMetric(agentCountActive);

const agentCountTotal = new client.Counter({
  name: 'agent_count_total',
  help: 'Number of agents created since server start',
  labelNames: ['agent', 'mode'] as const
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

export async function metricsAgentResponseTime<T>(agent: string, route: string, f: Promise<T>): Promise<T> {
  const end = agentResponseTime.startTimer();
  const res = await f;
  end({ agent, route });
  return res;
}

export function metricsAgentCountActiveConnect(agent: string, mode: string) {
  agentCountActive.labels({ agent, mode }).inc();
  agentCountTotal.labels({ agent, mode }).inc();
}

// TODO: need graceful shutdown
export function metricsAgentCountActiveDisconnet(agent: string, mode: string) {
  agentCountActive.labels({ agent, mode }).dec();
}

export function metricsAgentToolUseCount(agent: string, mode: string, tool: string) {
  const counter = agentToolUseCounter.get(tool) || (() => {
    const counterNew = new client.Counter({
      name: `tool_${tool}_use_counter`,
      help: 'Number of times an agent uses this tool',
      labelNames: ['agent', 'mode'] as const
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
  buckets: [0.5, 1, 2, 5, 10, 15, 30, 60, 120]
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

export async function metricsDbResponseTime<T>(query: string, f: () => Promise<T>) {
  const end = DbQueryTime.startTimer();
  const res = await f();
  end({ query });
  res
}
