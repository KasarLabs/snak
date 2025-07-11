import { metrics } from '../metrics.js';
import client from 'prom-client';

describe('metrics singleton', () => {
  beforeEach(() => {
    client.register.resetMetrics();
  });

  it('collects user token usage', async () => {
    metrics.userTokenUsage('u1', 'agentA', 5, 7);
    const out = await metrics.metrics();
    expect(out).toContain('user_prompt_tokens_total');
    expect(out).toContain('user_tokens_total');
  });
});