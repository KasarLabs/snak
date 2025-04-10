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
	it('Should handle insertions', async () => {
		const project1: scarb.Project = { name: "Foo", type: 'contract' };
		await expect(scarb.insertProject(project1)).resolves.toBeUndefined();

		const project2: scarb.Project = { name: "Bazz", type: 'contract' };
		await expect(scarb.insertProject(project2)).resolves.toBeUndefined();
	});

	it('Should handle duplicates', async () => {
		const project: scarb.Project = { name: "Foo", type: 'cairo_program' };
		await expect(scarb.insertProject(project)).resolves.toBeUndefined();
	});

	it('Should handle deletions', async () => {
		const project: scarb.Project = { id: 1, name: "Foo", type: 'contract' };
		await expect(scarb.deleteProject('Bazz')).resolves.toBeUndefined();
		await expect(scarb.selectProject('Bazz')).resolves.toEqual([]);
		await expect(scarb.selectProject('Foo')).resolves.toEqual([project]);
	});

	it('Should handle invalid deletions', async () => {
		const project: scarb.Project = { id: 1, name: "Foo", type: 'contract' };
		await expect(scarb.deleteProject('FooBazz')).resolves.toBeUndefined();
		await expect(scarb.selectProject('Foo')).resolves.toEqual([project]);
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
	it('Should handle insertions', async () => {
		const project = (await scarb.selectProject("Foo"))!;
		const program1: scarb.Program = { project_id: project.id!, name: "Fibonacci", source_code: "fibb_recursive" };
		await expect(scarb.insertProgram(program1)).resolves.toBeUndefined();

		const program2: scarb.Program = { project_id: project.id!, name: "Sieve", source_code: "prime_sieve" };
		await expect(scarb.insertProgram(program2)).resolves.toBeUndefined();

		const program3: scarb.Program = { project_id: project.id!, name: "Marching Cubes", source_code: "marching_cubes" };
		await expect(scarb.insertProgram(program3)).resolves.toBeUndefined();
	});

	it('Should handle duplicates', async () => {
		const project = (await scarb.selectProject("Foo"))!;
		const program: scarb.Program = { project_id: project.id!, name: "Fibonacci", source_code: "fibb_iterative" };
		await expect(scarb.insertProgram(program)).resolves.toBeUndefined();
	});

	it('Should handle deletions', async () => {
		await expect(scarb.deleteProgram(1, "Marching Cubes")).resolves.toBeUndefined();
		await expect(scarb.selectPrograms(1)).resolves.toHaveLength(2);
	});

	it('Should handle invalid deletions', async () => {
		await expect(scarb.deleteProgram(1, 'FFT')).resolves.toBeUndefined();
		await expect(scarb.selectPrograms(1)).resolves.toHaveLength(2);
	});

	it('Should handle retrievals', async () => {
		const project = (await scarb.selectProject("Foo"))!;
		const program1: scarb.Program = {
			project_id: project.id!,
			name: "Fibonacci",
			source_code: "fibb_iterative",
			sierra: null,
			casm: null
		};
		const program2: scarb.Program = {
			project_id: project.id!,
			name: "Sieve",
			source_code: "prime_sieve",
			sierra: null,
			casm: null
		};
		await expect(scarb.selectPrograms(project.id!)).resolves.toEqual([program1, program2]);
	});

	it('Should handle invalid retrievals', async () => {
		await expect(scarb.selectPrograms(2)).resolves.toEqual([]);
	});
})

describe('Dependency table', () => {
	it('Should handle insertions', async () => {
		const project = (await scarb.selectProject("Foo"))!;
		const dependency1: scarb.Dependency = { project_id: project.id!, name: "libc", version: '1.0.0' };
		await expect(scarb.insertDependency(dependency1)).resolves.toBeUndefined();

		const dependency2: scarb.Dependency = { project_id: project.id!, name: "gcc" };
		await expect(scarb.insertDependency(dependency2)).resolves.toBeUndefined();

		const dependency3: scarb.Dependency = { project_id: 1, name: "qt" };
		await expect(scarb.insertDependency(dependency3)).resolves.toBeUndefined();
	});

	it('Should handle duplicates', async () => {
		const project = (await scarb.selectProject("Foo"))!;
		const dependency: scarb.Dependency = { project_id: project.id!, name: "libc", version: '2.0.0' };
		await expect(scarb.insertDependency(dependency)).resolves.toBeUndefined();
	});

	it('Should handle deletions', async () => {
		await expect(scarb.deleteDependency(1, 'qt')).resolves.toBeUndefined();
		await expect(scarb.selectDependencies(1)).resolves.toHaveLength(2);
	});

	it('Should handle invalid deletions', async () => {
		await expect(scarb.deleteDependency(1, 'ffmpeg')).resolves.toBeUndefined();
		await expect(scarb.selectDependencies(1)).resolves.toHaveLength(2);
	});

	it('Should handle retrieval', async () => {
		const project = (await scarb.selectProject("Foo"))!;
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

describe('Compilation results', () => {
	it('Should save', async () => {
		const programNames = ['Fibonacci', 'Sieve'];
		const sierraFiles = ["sierra1", "sierra2"];
		const casmFiles = ["casm1", "casm2"];
		const program1: scarb.Program = {
			project_id: 1,
			name: "Fibonacci",
			source_code: "fibb_iterative",
			sierra: "sierra1",
			casm: "casm1"
		};
		const program2: scarb.Program = {
			project_id: 1,
			name: "Sieve",
			source_code: "prime_sieve",
			sierra: "sierra2",
			casm: "casm2"
		};

		await expect(scarb.saveCompilationResults(programNames, sierraFiles, casmFiles)).resolves.toBeUndefined();
		await expect(scarb.selectPrograms(1)).resolves.toEqual([program1, program2]);
	});
})
