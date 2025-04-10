import { connect, shutdown } from "../../../database.js";
import { memory } from "../queries.js"

beforeAll(async () => {
	await connect();
});

afterAll(async () => {
	await shutdown();
})

describe('Memory database initialization', () => {
	it('Should create table', async () => {
		await expect(memory.init()).resolves.toBeUndefined();
	});

	it('Should be indempotent', async () => {
		await expect(memory.init()).resolves.toBeUndefined();
	})
})

describe('Memory table', () => {
	it('Should handle insertions', async () => {
		const m: memory.Memory = {
			user_id: 'default_user',
			content: 'content',
			embedding: `[${[...Array(384).keys()].join(',')}]`,
			metadata: {
				timestamp: 'now'
			},
			history: [
				{
					value: 'value',
					timestamp: 'now',
					action: 'UPDATE'
				}
			]
		};
		await expect(memory.insert_memory(m)).resolves.toBeUndefined();
	});

	it('Should handle updates', async () => {
		const content = 'content2';
		const embedding = `[${[...Array(384).keys()].map(n => n - 383).join(',')}]`;
		await expect(memory.update_memory(1, content, embedding)).resolves.toBeUndefined();
	});

	it('Should handle retrievals', async () => {
		const m = {
			user_id: 'default_user',
			content: 'content2',
			embedding: `[${[...Array(384).keys()].map(n => n - 383).join(',')}]`,
			metadata: {
				timestamp: 'now'
			},
			history: [
				{
					value: 'value',
					timestamp: 'now',
					action: 'UPDATE'
				},
				{
					value: 'content',
					action: 'UPDATE'
				}
			]
		};
		await expect(memory.select_memory(1)).resolves.toMatchObject(m);
	});

	it('Should handle invalid retrievals', async () => {
		await expect(memory.select_memory(2)).resolves.toBeUndefined();
	})
})
