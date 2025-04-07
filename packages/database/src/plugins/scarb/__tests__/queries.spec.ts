import { connect, shutdown } from "../../../database.js";
import {
	init,
	SchemaProject,
	insertProject,
	selectProject,
	SchemaProgram,
	insertProgram,
	selectPrograms,
	SchemaDependency,
	insertDependency,
	selectDependencies
} from '../queries.js'

beforeAll(async () => {
	await connect();
})

afterAll(async () => {
	await shutdown();
})

describe('Scarb database initialization', () => {
	it('Should create tables', async () => {
		await expect(init()).resolves.toBeUndefined();
	});

	it('Should be indempotent', async () => {
		await expect(init()).resolves.toBeUndefined();
	});
})

describe('Project table', () => {
	it('Should handle insertions', async () => {
		const project: SchemaProject = { name: "Foo", type: 'contract' };
		await expect(insertProject(project)).resolves.toBeUndefined();
	});

	it('Should handle duplicates', async () => {
		const project: SchemaProject = { name: "Foo", type: 'cairo_program' };
		await expect(insertProject(project)).resolves.toBeUndefined();
	});

	it('Should handle retrievals', async () => {
		const project: SchemaProject = { id: 1, name: "Foo", type: 'contract' };
		await expect(selectProject("Foo")).resolves.toEqual([project]);
	});
})

describe('Program table', () => {
	it('Should handle insertions', async () => {
		const project = (await selectProject("Foo"))![0];
		const program1: SchemaProgram = { project_id: project.id!, name: "Fibonacci", source_code: "fibb_recursive" };
		await expect(insertProgram(program1)).resolves.toBeUndefined();

		const program2: SchemaProgram = { project_id: project.id!, name: "Sieve", source_code: "prime_sieve" };
		await expect(insertProgram(program2)).resolves.toBeUndefined();
	});

	it('Should handle duplicates', async () => {
		const project = (await selectProject("Foo"))![0];
		const program: SchemaProgram = { project_id: project.id!, name: "Fibonacci", source_code: "fibb_iterative" };
		await expect(insertProgram(program)).resolves.toBeUndefined();
	});

	it('Should handle retrievals', async () => {
		const project = (await selectProject("Foo"))![0];
		const program1: SchemaProgram = { project_id: project.id!, name: "Fibonacci", source_code: "fibb_iterative" };
		const program2: SchemaProgram = { project_id: project.id!, name: "Sieve", source_code: "prime_sieve" };
		await expect(selectPrograms(project.id!)).resolves.toEqual([program1, program2]);
	});
})

describe('Dependency table', () => {
	it('Should handle insertions', async () => {
		const project = (await selectProject("Foo"))![0];
		const dependency1: SchemaDependency = { project_id: project.id!, name: "libc", version: '1.0.0' };
		await expect(insertDependency(dependency1)).resolves.toBeUndefined();

		const dependency2: SchemaDependency = { project_id: project.id!, name: "gcc" };
		await expect(insertDependency(dependency2)).resolves.toBeUndefined();
	});

	it('Should handle duplicates', async () => {
		const project = (await selectProject("Foo"))![0];
		const dependency: SchemaDependency = { project_id: project.id!, name: "libc", version: '2.0.0' };
		await expect(insertDependency(dependency)).resolves.toBeUndefined();
	});

	it('Should handle retrieval', async () => {
		const project = (await selectProject("Foo"))![0];
		const dependency1: SchemaDependency = { project_id: project.id!, name: "libc", version: '2.0.0' };
		const dependency2: SchemaDependency = { project_id: project.id!, name: "gcc", version: "" };
		await expect(selectDependencies(project.id!)).resolves.toEqual([dependency1, dependency2]);
	})
})
