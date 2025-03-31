import client from 'prom-client';

export const register = new client.Registry();
export const contentType = register.contentType;

client.collectDefaultMetrics({ prefix: 'sank_', register });

export async function metrics(): Promise<string> {
  return await register.metrics();
}
