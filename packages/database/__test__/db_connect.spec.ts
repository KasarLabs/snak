import { describe } from "@jest/globals"
import { query, Query, shutdown } from "../src/database.js";

afterAll(async () => {
	await shutdown();
})

describe('Database connect', () => {
	it('Should connect to db', async () => {
		interface Model { state: string };
		const q = new Query("SELECT state FROM pg_stat_activity WHERE datname = $1;", [process.env.POSTGRES_DB!]);
		await expect(query<Model>(q)).resolves.toEqual([{ state: "active" }]);
	});
});

describe('Database queries', () => {
	it('Should handle table creation', async () => {
		let q = new Query(
			`CREATE TABLE users(
				id SERIAL PRIMARY KEY,
				name VARCHAR(255) NOT NULL,
				age INT
			);`
		);
		await expect(query(q)).resolves.toHaveLength(0);

		q = new Query(
			`INSERT INTO users(name, age) VALUES
				('bob', 42), ('ben', 43), ('barry', 44);`
		);
		await expect(query(q)).resolves.toHaveLength(0);

		interface Model { name: string };
		q = new Query(`SELECT name FROM users WHERE age < 44;`);
		await expect(query<Model[]>(q)).resolves.toEqual([{ name: "bob" }, { name: "ben" }])
	})
})
