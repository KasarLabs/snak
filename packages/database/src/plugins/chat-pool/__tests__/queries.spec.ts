import { connect, shutdown } from "../../../database.js";
import { init, insert_instruction, SchemaInstruction, select_instruction } from '../queries.js'

beforeAll(async () => {
	await connect();
})

afterAll(async () => {
	await shutdown();
})

describe('Chat-pool database initialization', () => {
	it('Should create tables', async () => {
		await expect(init()).resolves.toBeUndefined();
	});

	it('Should be indempotent', async () => {
		await expect(init()).resolves.toBeUndefined();
	});

	it('Should handle insertions', async () => {
		await expect(insert_instruction("Lorem Ipsum dolor si amet")).resolves.toBeUndefined();
	});

	it('Should handle retrievals', async () => {
		const instruction: SchemaInstruction = { instruction: "Lorem Ipsum dolor si amet" };
		await expect(select_instruction()).resolves.toEqual([instruction]);
	});
})
