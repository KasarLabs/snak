import { describe } from "@jest/globals"
import { query, Query, shutdown } from "../src/database.js";

describe('Database connect', () => {
	afterEach(async () => {
		await shutdown();
	})

	it('Should connect to db', async () => {
		interface Model { state: string };
		const q = new Query("SELECT state FROM pg_stat_activity WHERE datname = $1;", [process.env.POSTGRES_DATABASE!]);
		await expect(query<Model>(q)).resolves.toEqual({ state: "active" });
	});
});
