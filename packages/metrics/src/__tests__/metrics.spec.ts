// metrics.test.ts
import { metrics } from '../metrics.js';
import client from 'prom-client';

describe('Metrics singleton', () => {
  beforeEach(() => {
    // Réinitialise toutes les métriques entre chaque test
    client.register.resetMetrics();
    // Reset internal flag so register() se relance
    // @ts-ignore
    metrics.registered = false;
  });

  it('exposes the correct contentType', () => {
    expect(metrics.contentType).toBe(client.register.contentType);
  });

  it('metrics() contient les métriques déclarées après appel userTokenUsage', async () => {
    metrics.userTokenUsage('u1', 'agentA', 5, 7);
    const out = await metrics.metrics();
    expect(out).toContain('user_prompt_tokens_total');
    expect(out).toContain('user_completion_tokens_total');
    expect(out).toContain('user_tokens_total');
    // Vérifier qu’on a bien 5 + 7 = 12 sur user_tokens_total
    expect(out).toMatch(/user_tokens_total\{user="u1",agent="agentA"\} 12/);
  });

  it('agentConnect / agentDisconnect incrémente et décrémente correctement', async () => {
    metrics.agentConnect('MyAgent', 'interactive');
    let out = await metrics.metrics();
    expect(out).toMatch(/agent_count_active\{agent="MyAgent",mode="interactive"\} 1/);
    expect(out).toMatch(/agent_count_total\{agent="MyAgent",mode="interactive"\} 1/);

    metrics.agentDisconnect('MyAgent', 'interactive');
    out = await metrics.metrics();
    expect(out).toMatch(/agent_count_active\{agent="MyAgent",mode="interactive"\} 0/);
  });

  it('agentToolUseCount crée et incrémente tool_<tool>_use_counter', async () => {
    metrics.agentToolUseCount('A1', 'auto', 'fooTool');
    const out = await metrics.metrics();
    expect(out).toContain('tool_fooTool_use_counter');
    expect(out).toMatch(/tool_fooTool_use_counter\{agent="A1",mode="auto"\} 1/);
  });

  it('agentMsgCount crée et incrémente agent_<msgType>_messages_total', async () => {
    metrics.agentMsgCount('A1', 'auto', 'in');
    const out = await metrics.metrics();
    expect(out).toContain('agent_in_messages_total');
    expect(out).toMatch(/agent_in_messages_total\{agent="A1",mode="auto"\} 1/);
  });

  it('agentResponseTimeMeasure mesure et renvoie la valeur', async () => {
    const fake = Promise.resolve(42);
    const res = await metrics.agentResponseTimeMeasure('X', 'm', '/r', fake);
    expect(res).toBe(42);

    const out = await metrics.metrics();
    // On vérifie qu’au moins un bucket est présent pour la métrique
    expect(out).toContain('agent_response_time_seconds_bucket');
    // et que notre label apparait
    expect(out).toMatch(/agent="X",mode="m",route="\/r"/);
  });

  it('dbResponseTime mesure le temps de la fonction DB', async () => {
    const f = () => Promise.resolve('pong');
    const res = await metrics.dbResponseTime('q1', f);
    expect(res).toBe('pong');

    const out = await metrics.metrics();
    expect(out).toContain('db_response_time_seconds_bucket');
    expect(out).toMatch(/query="q1"/);
  });

  it('userAgentConnect / userAgentDisconnect gère les compteurs user_agent_active et total', async () => {
    metrics.userAgentConnect('u2', 'A2', 'web');
    let out = await metrics.metrics();
    expect(out).toMatch(/user_agent_active\{user="u2",agent="A2",mode="web"\} 1/);
    expect(out).toMatch(/user_agent_total\{user="u2",agent="A2",mode="web"\} 1/);

    metrics.userAgentDisconnect('u2', 'A2', 'web');
    out = await metrics.metrics();
    expect(out).toMatch(/user_agent_active\{user="u2",agent="A2",mode="web"\} 0/);
  });
});
