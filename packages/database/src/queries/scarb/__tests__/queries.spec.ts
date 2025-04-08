import { connect, shutdown } from "../../../database.js";
import { scarb } from '../queries.js'

beforeAll(async () => {
	await connect();
})

afterAll(async () => {
	await shutdown();
})

describe('Scarb database initialization', () => {
	it('Should create tables', async () => {
		await expect(scarb.init()).resolves.toBeUndefined();
	});

	it('Should be indempotent', async () => {
		await expect(scarb.init()).resolves.toBeUndefined();
	});
})

describe('Project table', () => {
	it('Should handle scarb.insertions', async () => {
		const project: scarb.Project = { name: "Foo", type: 'contract' };
		await expect(scarb.insertProject(project)).resolves.toBeUndefined();
	});

	it('Should handle duplicates', async () => {
		const project: scarb.Project = { name: "Foo", type: 'cairo_program' };
		await expect(scarb.insertProject(project)).resolves.toBeUndefined();
	});

	it('Should handle retrievals', async () => {
		const project: scarb.Project = { id: 1, name: "Foo", type: 'contract' };
		await expect(scarb.selectProject("Foo")).resolves.toEqual([project]);
	});

	it('Should handle invalid retrievals', async () => {
		await expect(scarb.selectProject('Bazz')).resolves.toEqual([]);
	});
})

describe('Program table', () => {
	it('Should handle scarb.insertions', async () => {
		const project = (await scarb.selectProject("Foo"))![0];
		const program1: scarb.Program = { project_id: project.id!, name: "Fibonacci", source_code: "fibb_recursive" };
		await expect(scarb.insertProgram(program1)).resolves.toBeUndefined();

		const program2: scarb.Program = { project_id: project.id!, name: "Sieve", source_code: "prime_sieve" };
		await expect(scarb.insertProgram(program2)).resolves.toBeUndefined();
	});

	it('Should handle duplicates', async () => {
		const project = (await scarb.selectProject("Foo"))![0];
		const program: scarb.Program = { project_id: project.id!, name: "Fibonacci", source_code: "fibb_iterative" };
		await expect(scarb.insertProgram(program)).resolves.toBeUndefined();
	});

	it('Should handle retrievals', async () => {
		const project = (await scarb.selectProject("Foo"))![0];
		const program1: scarb.Program = { project_id: project.id!, name: "Fibonacci", source_code: "fibb_iterative" };
		const program2: scarb.Program = { project_id: project.id!, name: "Sieve", source_code: "prime_sieve" };
		await expect(scarb.selectPrograms(project.id!)).resolves.toEqual([program1, program2]);
	});

	it('Should handle invalid retrievals', async () => {
		await expect(scarb.selectPrograms(2)).resolves.toEqual([]);
	});
})

describe('Dependency table', () => {
	it('Should handle scarb.insertions', async () => {
		const project = (await scarb.selectProject("Foo"))![0];
		const dependency1: scarb.Dependency = { project_id: project.id!, name: "libc", version: '1.0.0' };
		await expect(scarb.insertDependency(dependency1)).resolves.toBeUndefined();

		const dependency2: scarb.Dependency = { project_id: project.id!, name: "gcc" };
		await expect(scarb.insertDependency(dependency2)).resolves.toBeUndefined();
	});

	it('Should handle duplicates', async () => {
		const project = (await scarb.selectProject("Foo"))![0];
		const dependency: scarb.Dependency = { project_id: project.id!, name: "libc", version: '2.0.0' };
		await expect(scarb.insertDependency(dependency)).resolves.toBeUndefined();
	});

	it('Should handle retrieval', async () => {
		const project = (await scarb.selectProject("Foo"))![0];
		const dependency1: scarb.Dependency = { project_id: project.id!, name: "libc", version: '2.0.0' };
		const dependency2: scarb.Dependency = { project_id: project.id!, name: "gcc", version: "" };
		await expect(scarb.selectDependencies(project.id!)).resolves.toEqual([dependency1, dependency2]);
	});

	it('Should handle invalid retrievals', async () => {
		await expect(scarb.selectDependencies(2)).resolves.toEqual([]);
	});
})

describe('Project aggregation', () => {
	it('Should work', async () => {
		const program1: scarb.Program = { project_id: 1, name: "Fibonacci", source_code: "fibb_iterative" };
		const program2: scarb.Program = { project_id: 1, name: "Sieve", source_code: "prime_sieve" };
		const dependency1: scarb.Dependency = { project_id: 1, name: "libc", version: '2.0.0' };
		const dependency2: scarb.Dependency = { project_id: 1, name: "gcc", version: "" };
		const projectData: scarb.ProjectData = {
			id: 1,
			name: 'Foo',
			type: 'contract',
			programs: [program1, program2],
			dependencies: [dependency1, dependency2]
		};
		await expect(scarb.retrieveProjectData("Foo")).resolves.toEqual(projectData);
	});

	it('Should handle missing projects', async () => {
		await expect(scarb.retrieveProjectData('Bazz')).resolves.toBeUndefined();
	});
})
