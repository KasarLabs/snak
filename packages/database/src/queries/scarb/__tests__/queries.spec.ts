import { DatabaseCredentials } from '../../../utils/database.js';
import { Postgres } from '../../../database.js';
import { Id } from '../../common.js';
import { scarbQueries, scarb } from '../queries.js';

const databasecredentials: DatabaseCredentials = {
  user: process.env.POSTGRES_USER as string,
  host: process.env.POSTGRES_HOST as string,
  database: process.env.POSTGRES_DB as string,
  password: process.env.POSTGRES_PASSWORD as string,
  port: parseInt(process.env.POSTGRES_PORT || '5454'),
};

let _scarbQueries = new scarbQueries(databasecredentials);

beforeAll(async () => {
  await _scarbQueries.connect(
    process.env.POSTGRES_USER as string,
    process.env.POSTGRES_HOST as string,
    process.env.POSTGRES_DB as string,
    process.env.POSTGRES_PASSWORD as string,
    parseInt(process.env.POSTGRES_PORT || '5454')
  );
});

afterAll(async () => {
  await _scarbQueries.shutdown();
});

describe('Scarb database initialization', () => {
  it('Should create tables', async () => {
    await expect(_scarbQueries.init()).resolves.toBeUndefined();
  });

  it('Should be indempotent', async () => {
    await expect(_scarbQueries.init()).resolves.toBeUndefined();
  });
});

describe('Project table', () => {
  it('Should handle insertions', async () => {
    const project1: scarb.Project = { name: 'Foo', type: 'contract' };

    await expect(
      _scarbQueries.insertProject(project1)
    ).resolves.toBeUndefined();
  });

  it('Should handle_scarbQueries.init duplicates', async () => {
    const project: scarb.Project = { name: 'Foo', type: 'cairo_program' };

    await expect(_scarbQueries.insertProject(project)).resolves.toBeUndefined();
  });

  it('Should handle retrievals', async () => {
    const project: scarb.Project = { name: 'Foo', type: 'contract' };

    await expect(_scarbQueries.selectProject('Foo')).resolves.toMatchObject(
      project
    );
  });

  it('Should handle invalid retrievals', async () => {
    await expect(_scarbQueries.selectProject('Bazz')).resolves.toBeUndefined();
  });

  it('Should handle deletions', async () => {
    const project2: scarb.Project = { name: 'Bazz', type: 'contract' };

    await expect(
      _scarbQueries.insertProject(project2)
    ).resolves.toBeUndefined();
    await expect(_scarbQueries.selectProject('Bazz')).resolves.toMatchObject(
      project2
    );

    const project: scarb.Project = { name: 'Foo', type: 'contract' };
    await expect(_scarbQueries.deleteProject('Bazz')).resolves.toBeUndefined();
    await expect(_scarbQueries.selectProject('Bazz')).resolves.toBeUndefined();
    await expect(_scarbQueries.selectProject('Foo')).resolves.toMatchObject(
      project
    );
  });

  it('Should handle invalid deletions', async () => {
    const project: scarb.Project = { name: 'Foo', type: 'contract' };

    await expect(
      _scarbQueries.deleteProject('FooBazz')
    ).resolves.toBeUndefined();
    await expect(_scarbQueries.selectProject('Foo')).resolves.toMatchObject(
      project
    );
  });
});

describe('Program table', () => {
  it('Should handle insertions', async () => {
    const project = (await _scarbQueries.selectProject('Foo'))!;
    const program1: scarb.Program<Id.Id> = {
      project_id: project.id,
      name: 'Fibonacci',
      source_code: 'fibb_recursive',
    };
    await expect(
      _scarbQueries.insertProgram(program1)
    ).resolves.toBeUndefined();

    const program2: scarb.Program<Id.Id> = {
      project_id: project.id,
      name: 'Sieve',
      source_code: 'prime_sieve',
    };
    await expect(
      _scarbQueries.insertProgram(program2)
    ).resolves.toBeUndefined();
  });

  it('Should handle duplicates', async () => {
    const project = (await _scarbQueries.selectProject('Foo'))!;
    const program: scarb.Program<Id.Id> = {
      project_id: project.id,
      name: 'Fibonacci',
      source_code: 'fibb_iterative',
    };
    await expect(_scarbQueries.insertProgram(program)).resolves.toBeUndefined();
  });

  it('Should handle retrievals', async () => {
    const project = (await _scarbQueries.selectProject('Foo'))!;
    const program1: scarb.Program<Id.Id> = {
      project_id: project.id,
      name: 'Fibonacci',
      source_code: 'fibb_iterative',
      sierra: null,
      casm: null,
    };
    const program2: scarb.Program<Id.Id> = {
      project_id: project.id,
      name: 'Sieve',
      source_code: 'prime_sieve',
      sierra: null,
      casm: null,
    };
    await expect(_scarbQueries.selectPrograms(project.id)).resolves.toEqual([
      program1,
      program2,
    ]);
  });

  it('Should handle invalid retrievals', async () => {
    await expect(_scarbQueries.selectPrograms(2)).resolves.toEqual([]);
  });

  it('Should handle deletions', async () => {
    const program3: scarb.Program<Id.Id> = {
      project_id: 1,
      name: 'Marching Cubes',
      source_code: 'marching_cubes',
    };

    await expect(
      _scarbQueries.insertProgram(program3)
    ).resolves.toBeUndefined();
    await expect(_scarbQueries.selectPrograms(1)).resolves.toHaveLength(3);

    await expect(
      _scarbQueries.deleteProgram(1, 'Marching Cubes')
    ).resolves.toBeUndefined();
    await expect(_scarbQueries.selectPrograms(1)).resolves.toHaveLength(2);
  });

  it('Should handle invalid deletions', async () => {
    await expect(
      _scarbQueries.deleteProgram(1, 'FFT')
    ).resolves.toBeUndefined();
    await expect(_scarbQueries.selectPrograms(1)).resolves.toHaveLength(2);
  });
});

describe('Dependency table', () => {
  it('Should handle insertions', async () => {
    const project = (await _scarbQueries.selectProject('Foo'))!;
    const dependency1: scarb.Dependency<Id.Id> = {
      project_id: project.id,
      name: 'libc',
      version: '1.0.0',
    };
    await expect(
      _scarbQueries.insertDependency(dependency1)
    ).resolves.toBeUndefined();

    const dependency2: scarb.Dependency<Id.Id> = {
      project_id: project.id,
      name: 'gcc',
    };
    await expect(
      _scarbQueries.insertDependency(dependency2)
    ).resolves.toBeUndefined();
  });

  it('Should handle duplicates', async () => {
    const project = (await _scarbQueries.selectProject('Foo'))!;
    const dependency: scarb.Dependency<Id.Id> = {
      project_id: project.id,
      name: 'libc',
      version: '2.0.0',
    };
    await expect(
      _scarbQueries.insertDependency(dependency)
    ).resolves.toBeUndefined();
  });

  it('Should handle retrieval', async () => {
    const project = (await _scarbQueries.selectProject('Foo'))!;
    const dependency1: scarb.Dependency<Id.Id> = {
      project_id: project.id,
      name: 'libc',
      version: '2.0.0',
    };
    const dependency2: scarb.Dependency<Id.Id> = {
      project_id: project.id,
      name: 'gcc',
      version: '',
    };
    await expect(_scarbQueries.selectDependencies(project.id)).resolves.toEqual(
      [dependency1, dependency2]
    );
  });

  it('Should handle invalid retrievals', async () => {
    await expect(_scarbQueries.selectDependencies(2)).resolves.toEqual([]);
  });

  it('Should handle deletions', async () => {
    const project = (await _scarbQueries.selectProject('Foo'))!;
    const dependency3: scarb.Dependency<Id.Id> = {
      project_id: project.id,
      name: 'qt',
    };
    await expect(
      _scarbQueries.insertDependency(dependency3)
    ).resolves.toBeUndefined();
    await expect(
      _scarbQueries.selectDependencies(project.id)
    ).resolves.toHaveLength(3);

    await expect(
      _scarbQueries.deleteDependency(project.id, 'qt')
    ).resolves.toBeUndefined();
    await expect(
      _scarbQueries.selectDependencies(project.id)
    ).resolves.toHaveLength(2);
  });

  it('Should handle invalid deletions', async () => {
    await expect(
      _scarbQueries.deleteDependency(1, 'ffmpeg')
    ).resolves.toBeUndefined();
    await expect(_scarbQueries.selectDependencies(1)).resolves.toHaveLength(2);
  });
});

describe('Project aggregation', () => {
  it('Should work', async () => {
    const programs: scarb.Program[] = [
      { name: 'Fibonacci', source_code: 'fibb_iterative' },
      { name: 'Sieve', source_code: 'prime_sieve' },
    ];
    const dependencies: scarb.Dependency[] = [
      { name: 'libc', version: '2.0.0' },
      { name: 'gcc', version: '' },
    ];
    const projectData = {
      name: 'Foo',
      type: 'contract',
      programs,
      dependencies,
    };

    await expect(
      _scarbQueries.retrieveProjectData('Foo')
    ).resolves.toMatchObject(projectData);
  });

  it('Should handle missing projects', async () => {
    await expect(
      _scarbQueries.retrieveProjectData('Bazz')
    ).resolves.toBeUndefined();
  });
});

describe('Compilation results', () => {
  it('Should save', async () => {
    const project = (await _scarbQueries.selectProject('Foo'))!;
    const programNames = ['Fibonacci', 'Sieve'];
    const sierraFiles = ['sierra1', 'sierra2'];
    const casmFiles = ['casm1', 'casm2'];
    const program1: scarb.Program<Id.Id> = {
      project_id: project.id,
      name: 'Fibonacci',
      source_code: 'fibb_iterative',
      sierra: 'sierra1',
      casm: 'casm1',
    };
    const program2: scarb.Program<Id.Id> = {
      project_id: project.id,
      name: 'Sieve',
      source_code: 'prime_sieve',
      sierra: 'sierra2',
      casm: 'casm2',
    };

    await expect(
      _scarbQueries.saveCompilationResults(programNames, sierraFiles, casmFiles)
    ).resolves.toBeUndefined();
    await expect(_scarbQueries.selectPrograms(1)).resolves.toEqual([
      program1,
      program2,
    ]);
  });
});

describe('Execution results', () => {
  it('Should save', async () => {
    const project = (await _scarbQueries.selectProject('Foo'))!;
    const trace = Buffer.from('trace');

    await expect(
      _scarbQueries.saveExecutionResults(project.id, trace)
    ).resolves.toBeUndefined();
    await expect(_scarbQueries.selectProject('Foo')).resolves.toHaveProperty(
      'execution_trace',
      trace
    );
  });
});

describe('Proof results', () => {
  it('Should save', async () => {
    const project = (await _scarbQueries.selectProject('Foo'))!;
    const proof = 'proof';

    await expect(
      _scarbQueries.saveProof(project.id, proof)
    ).resolves.toBeUndefined();
    await expect(_scarbQueries.selectProject('Foo')).resolves.toHaveProperty(
      'proof',
      proof
    );
  });
});

describe('Verification results', () => {
  it('Should save', async () => {
    const project = (await _scarbQueries.selectProject('Foo'))!;
    const verified = true;

    await expect(
      _scarbQueries.saveVerify(project.id, verified)
    ).resolves.toBeUndefined();
    await expect(_scarbQueries.selectProject('Foo')).resolves.toHaveProperty(
      'verified',
      verified
    );
  });
});

describe('Project initialization', () => {
  it('Should work', async () => {
    const project: scarb.Project = { name: 'Doom', type: 'contract' };
    const programs: scarb.Program[] = [
      { name: 'Q_rsqrt', source_code: '0x5F3759DF' },
      { name: 'bsp', source_code: 'ft_bsp' },
    ];
    const dependencies: scarb.Dependency[] = [
      { name: 'Carmack', version: '2.3' },
      { name: 'Romero', version: '2.6' },
    ];

    const projectData = {
      name: 'Doom',
      type: 'contract',
      programs,
      dependencies,
    };

    await expect(
      _scarbQueries.initProject(project, programs, dependencies)
    ).resolves.toMatchObject(projectData);
    await expect(
      _scarbQueries.retrieveProjectData('Doom')
    ).resolves.toMatchObject(projectData);
  });
});
