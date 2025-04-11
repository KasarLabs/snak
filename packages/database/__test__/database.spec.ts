import { query, transaction, connect, shutdown, Query } from "../src/database.js";

beforeAll(async () => {
	await connect();
})

afterAll(async () => {
	await shutdown();
})

describe('Database connect', () => {
	it('Should connect to db', async () => {
		interface Model { state: string };
		const q = new Query("SELECT state FROM pg_stat_activity WHERE datname = $1;", [process.env.POSTGRES_DB!]);
		await expect(query<Model>(q)).resolves.toContainEqual({ state: "active" });
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

	it("Should handle transactions", async () => {
		const t = [
			new Query(
				`CREATE TABLE job_details(
					job VARCHAR(255) PRIMARY KEY,
					pay_avg INT
				);`
			),
			new Query(
				`CREATE TABLE employees(
					id SERIAL PRIMARY KEY,
					name VARCHAR(255) NOT NULL,
					age INT,
					job VARCHAR(255) REFERENCES job_details(job)
				);`
			),
			new Query(
				`INSERT INTO job_details(job, pay_avg) VALUES
					('painter', 50),
					('dev', 100),
					('teacher', '20');`
			),
			new Query(
				`INSERT INTO employees(name, age, job) VALUES
					('jeff', 42, 'painter'),
					('john', 43, 'painter'),
					('joe', 44, 'dev'),
					('jepsen', 45, 'teacher');`
			),
		];
		await expect(transaction(t)).resolves.toBeUndefined();

		interface Model { name: string, age: number, job: string, pay_avg: number };
		const q = new Query(
			`SELECT employees.name, employees.age, job_details.job, job_details.pay_avg
				FROM employees
					JOIN job_details ON employees.job = job_details.job
				WHERE job_details.job = 'painter';`
		);
		await expect(query<Model>(q)).resolves.toEqual([
			{ name: "jeff", age: 42, job: "painter", pay_avg: 50 },
			{ name: "john", age: 43, job: "painter", pay_avg: 50 },
		])
	})
})
