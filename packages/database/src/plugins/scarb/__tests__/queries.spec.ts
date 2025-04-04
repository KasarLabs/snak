import { connect, shutdown } from "../../../database.js";
import { init } from '../queries.js'

beforeAll(async () => {
	await connect();
})

afterAll(async () => {
	await shutdown();
})

describe('Scarb database initlaization', () => {
	it('Should create tables', async () => {
		await expect(init()).resolves.toBeUndefined();
	})

	it('Should be indempotent', async () => {
		await expect(init()).resolves.toBeUndefined();
	})
})
