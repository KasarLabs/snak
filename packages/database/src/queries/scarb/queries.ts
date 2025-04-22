import { DatabaseCredentials } from '../../utils/database.js';
import { Postgres, Query } from '../../database.js';
import { Id } from '../common.js';
import { DatabaseError } from '../../error.js';

export namespace scarb {
  export interface ProjectBase {
    name: string;
    type: 'contract' | 'cairo_program';
    execution_trace?: string;
    proof?: string;
    verified?: boolean;
  }
  export interface ProjectWithId extends ProjectBase {
    id: number;
  }

  /**
   * A scarb project, from which new { @see Program } can be created and
   * { @see Dependency } added.
   *
   * @param { number } [id] - Project id in db (optional).
   * @param { 'contract' | 'cairo_program' } type - Project type.
   * @param { string } [execution_trace] - Program execution trace.
   * @param { string } [proof] - Cairo proof associated to a program execution.
   * @param { boolean } [verified] - Whether a program's execution has been verified.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export type Project<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? ProjectWithId
    : ProjectBase;

  export interface ProgramBase {
    name: string;
    source_code: string;
    sierra?: string | null; // FIXME: we can do better than maybe null by leveraging generics
    casm?: string | null;
  }
  export interface ProgramWithId extends ProgramBase {
    project_id: number;
  }

  /**
   * A program which is related to a { @see Project }.
   *
   * @field { number } [project_id] - Id of the Project the program is part of.
   * @field { string } name - Program name.
   * @field { string } source_code - Program source code.
   * @field { string } [sierra] - Program sierra, only on compiled programs.
   * @field { string } [casm] - Program casm, only on complied programs.
   */
  export type Program<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? ProgramWithId
    : ProgramBase;

  /**
   * Information related to a { @see Project }, its { @see Program }s and
   * { @see Dependency }s.
   */
  export interface ProjectData {
    id: number;
    name: string;
    type: 'contract' | 'cairo_program';
    programs: Program<Id.Id>[];
    dependencies: Dependency<Id.Id>[];
    execution_trace?: string;
    proof?: string;
    verified?: boolean;
  }

  export interface ProjectQueryRes {
    project_id: number;
    project_name: string;
    project_type: 'contract' | 'cairo_program';
    project_trace?: string;
    project_proof?: string;
    project_verif?: boolean;
    program_name?: string;
    program_code?: string;
    dep_name?: string;
    dep_version?: string;
  }

  export interface DepBase {
    name: string;
    version?: string;
  }
  export interface DepWithId extends DepBase {
    project_id: number;
  }

  /**
   * An external dependency associated to a { @see Project }.
   *
   * @field { number } [project_id] - Id of the Project the dependency is part of.
   * @field { string } name - Dependency name.
   * @field { string } [version] - Dependency version.
   */
  export type Dependency<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? DepWithId
    : DepBase;
}
export class scarbQueries extends Postgres {
  constructor(credentials: DatabaseCredentials) {
    super(credentials);
  }

  /**
   * Initializes the { @see Project }, { @see Program } and { @see Dependency }
   * tables, as well as some helper functions.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async init(): Promise<void> {
    const t = [
      new Query(
        `CREATE TABLE IF NOT EXISTS project(
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            type VARCHAR(50) CHECK (type in ('contract', 'cairo_program')),
            execution_trace BYTEA,
            proof JSONB,
            verified BOOLEAN DEFAULT FALSE,
            UNIQUE (name)
          );`
      ),
      new Query(
        `CREATE TABLE IF NOT EXISTS program(
            id SERIAL PRIMARY KEY,
            project_id INTEGER REFERENCES project(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            source_code TEXT,
            sierra JSONB,
            casm JSONB,
            UNIQUE (project_id, name)
          )`
      ),
      new Query(
        `CREATE TABLE IF NOT EXISTS dependency(
            id SERIAL PRIMARY KEY,
            project_id INTEGER REFERENCES project(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            version VARCHAR(50),
            UNIQUE (project_id, name)
          )`
      ),
      new Query(
        `CREATE OR REPLACE FUNCTION insert_project(
            name varchar(100),
            type varchar(50)
          ) RETURNS integer AS $$
            INSERT INTO project(name, type) VALUES
              ($1, $2)
              ON CONFLICT (name)
              DO NOTHING
              RETURNING id;
          $$ LANGUAGE sql`
      ),
      new Query(
        `CREATE OR REPLACE FUNCTION insert_program(
            project_id integer,
            name varchar(255),
            source_code text
          ) RETURNS void AS $$
            INSERT INTO program (
              project_id,
              name,
              source_code
            ) VALUES (
              $1,
              $2,
              $3
            ) ON CONFLICT (
              project_id,
              name
            ) DO UPDATE 
              SET source_code = $3;
          $$ LANGUAGE sql;`
      ),
      new Query(
        `CREATE OR REPLACE FUNCTION insert_dependency(
            project_id integer,
            name varchar(255),
            version varchar(50)
          ) RETURNS void AS $$
            INSERT INTO dependency (
              project_id,
              name,
              version
            ) VALUES (
              $1,
              $2,
              COALESCE($3, '')
            ) ON CONFLICT (
              project_id, 
              name
            ) DO UPDATE 
              SET version = COALESCE($3, '');
          $$ LANGUAGE sql;`
      ),
      new Query(
        `CREATE OR REPLACE FUNCTION init_project(
            project jsonb,
            programs jsonb,
            dependencies jsonb
          ) RETURNS void AS $$
          DECLARE
            id integer := insert_project(project->>'name', project->>'type');
            program jsonb;
            dependency jsonb;
            count integer;
          BEGIN
            FOR program IN
              SELECT * FROM jsonb_array_elements(programs)
            LOOP
              PERFORM insert_program(
                id,
                program->>'name',
                program->>'source_code'
              );
            END LOOP;
  
            FOR dependency IN
              SELECT * FROM jsonb_array_elements(dependencies)
            LOOP
              PERFORM insert_dependency(
                id,
                dependency->>'name',
                dependency->>'version'
              );
            END LOOP;
           END;
          $$ LANGUAGE plpgsql;
          `
      ),
      new Query(
        `CREATE OR REPLACE FUNCTION retrieve_project(
            name varchar(100)
          ) RETURNS TABLE (
            project_id INTEGER,
            project_name VARCHAR(100),
            project_type VARCHAR(50),
            project_trace BYTEA,
            project_proof JSONB,
            project_verif BOOLEAN,
            program_name VARCHAR(255),
            program_code TEXT,
            dep_name VARCHAR(255),
            dep_version VARCHAR(50)
          ) AS $$
            SELECT * FROM(
              SELECT
                project.id AS project_id,
                project.name AS project_name,
                project.type AS project_type,
                project.execution_trace AS project_trace,
                project.proof AS project_proof,
                project.verified AS project_verif,
                program.name AS program_name,
                program.source_code AS program_code,
                NULL AS dep_name,
                NULL as dep_version
              FROM
                project
                LEFT JOIN program 
                  ON program.project_id = project.id
              WHERE
                project.name = $1
              ORDER BY program.id ASC
            )
            UNION ALL
            SELECT * FROM(
              SELECT
                project.id AS project_id,
                project.name AS project_name,
                project.type AS project_type,
                project.execution_trace AS project_trace,
                project.proof AS project_proof,
                project.verified AS project_verif,
                NULL AS program_name,
                NULL AS program_code,
                dependency.name AS dep_name,
                dependency.version as dep_version
              FROM
                project
                LEFT JOIN dependency
                  ON dependency.project_id = project.id
              WHERE
                project.name = $1
              ORDER BY dependency.id ASC
            );
          $$ LANGUAGE sql`
      ),
    ];
    await this.transaction(t);
  }
  /**
   * Inserts a { @see Project } into the db. Duplicates projects are rejected
   * but do not cause an error.
   *
   * @param { Project } project - The project to insert.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async insertProject(project: scarb.Project): Promise<void> {
    const q = new Query(`SELECT insert_project($1, $2);`, [
      project.name,
      project.type,
    ]);
    await this.query(q);
  }
  public async selectProject(
    name: string
  ): Promise<scarb.Project<Id.Id> | undefined> {
    const q = new Query(
      `SELECT
          id,
          name,
          type,
          execution_trace,
          proof,
          verified
        FROM
          project
        WHERE
          name = $1;`,
      [name]
    );
    const q_res = await this.query<scarb.Project<Id.Id>>(q);
    return q_res ? q_res[0] : undefined;
  }

  /**
   * Retrieves a { @see Project } by name from the db, if it exists.
   *
   * @param { string } name - Project name.
   *
   * @returns { Project<Id.Id> | undefined } Project at the given name.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async selectProjects(): Promise<scarb.Project[]> {
    const q = new Query(`SELECT id, name, type FROM project`);
    return await this.query(q);
  }

  /**
   * Deletes a { @see Project } by name from the db.
   *
   * @param { string } name - Project name.
   *
   * @throws { DatabaseError } If a database operation fails.
   */

  public async deleteProject(name: string): Promise<void> {
    const q = new Query(`DELETE FROM project WHERE name = $1`, [name]);
    await this.query(q);
  }

  /**
   * Atomically initializes a { @see Project }, along with all its
   * { @see Program }s and { @see Dependecy }.
   *
   * You should always use this function instead of calling
   * { @see insertProject }, { @see insertProgram } and
   * { @see insertDependency } separately if you are inserting more than a
   * single related element at a time.
   *
   * @param { Project } project - Project to initialize.
   * @param { Program[] } programs - Programs to initialize.
   * @param { Dependency[] } dependencies - Dependencies to initialize.
   *
   * @returns { ProjectData | undefined } The data which was inserted, if
   * successful.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async initProject(
    project: scarb.Project,
    programs: scarb.Program[],
    dependencies: scarb.Dependency[]
  ): Promise<scarb.ProjectData | undefined> {
    const t = [
      new Query(`SELECT init_project($1, $2, $3)`, [
        JSON.stringify(project),
        JSON.stringify(programs),
        JSON.stringify(dependencies),
      ]),
      new Query(`SELECT * FROM retrieve_project($1)`, [project.name]),
    ];
    const t_res = await this.transaction<scarb.ProjectQueryRes>(t);

    if (t_res.length) {
      const init: scarb.ProjectData = {
        id: 0,
        name: '',
        type: 'contract',
        programs: [],
        dependencies: [],
      };
      return t_res.reduce<scarb.ProjectData>(this.reduce, init);
    }
  }

  /**
   * Retrieves information about a { @see Project }, along with all of its
   * { @see Program }s and { @see Dependency }.
   *
   * @param { string } name - Project name
   *
   * @returns { ProjectData | undefined } The project data at a given name, if
   * it exists.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async retrieveProjectData(
    name: string
  ): Promise<scarb.ProjectData | undefined> {
    const q = new Query(`SELECT * FROM retrieve_project($1);`, [name]);

    const q_res = await this.query<scarb.ProjectQueryRes>(q);

    if (q_res.length) {
      const init: scarb.ProjectData = {
        id: 0,
        name: '',
        type: 'contract',
        programs: [],
        dependencies: [],
      };
      return q_res.reduce<scarb.ProjectData>(this.reduce, init);
    }
  }
  public reduce(
    acc: scarb.ProjectData,
    next: scarb.ProjectQueryRes
  ): scarb.ProjectData {
    acc.id = next.project_id;
    acc.name = next.project_name;
    acc.type = next.project_type;

    if (next.program_name) {
      acc.programs.push({
        project_id: next.project_id,
        name: next.program_name,
        source_code: next.program_code!,
      });
    }

    if (next.dep_name) {
      acc.dependencies.push({
        project_id: next.project_id,
        name: next.dep_name,
        version: next.dep_version,
      });
    }

    if (next.project_trace) {
      acc.execution_trace = next.project_trace;
    }

    if (next.project_proof) {
      acc.proof = next.project_proof;
    }

    if (next.project_verif) {
      acc.verified = next.project_verif;
    }

    return acc;
  }

  /**
   * Inserts a new { @see Program } into the database.
   *
   * The `source_code` is updated on `(project_id, name)` conflicts.
   *
   * @param { Program<Id.Id> } program - Program to insert.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async insertProgram(program: scarb.Program<Id.Id>): Promise<void> {
    const q = new Query(`SELECT insert_program($1, $2, $3);`, [
      program.project_id,
      program.name,
      program.source_code,
    ]);
    await this.query(q);
  }

  /**
   * Inserts multiple { @see Program }s into the database as a single atomic
   * transaction.
   *
   * @param { Program<Id.Id>[] } programs - Programs to insert.
   *
   * @throws { DatabaseError } If a database operation fails.
   */

  public async insertPrograms(programs: scarb.Program<Id.Id>[]): Promise<void> {
    const t = programs.map(
      (program) =>
        new Query(`SELECT insert_program($1, $2, $3);`, [
          program.project_id,
          program.name,
          program.source_code,
        ])
    );
    await this.transaction(t);
  }

  /**
   * Retrieves a single { @see Program } by { @see Project } id and name from
   * the db.
   *
   * @param { number } projectId - Id of the project the program is part of.
   * @param { string } programName - Program name.
   *
   * @returns { Program<Id.Id> | undefined } The program, if it exists.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async selectProgram(
    project_id: number,
    program_name: string
  ): Promise<scarb.Program<Id.Id> | undefined> {
    const q = new Query(
      `SELECT project_id, name, source_code, sierra, casm FROM program
        WHERE project_id = $1 AND name = $2
        ORDER BY id ASC;`,
      [project_id, program_name]
    );
    const q_res = await this.query<scarb.Program<Id.Id>>(q);
    return q_res ? q_res[0] : undefined;
  }

  /**
   * Retrieves all { @see Program }s associated to a { @see Project }.
   *
   * > [!WARNING]
   * > This is probably not a good idea and should be replace by a proper
   * > cursor or a limit asap.
   *
   * @param { number } project_id - Id of the project the program is part of.
   *
   * @returns { Program<Id.Id>[] } All programs associated to a project, if
   * any.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async selectPrograms(
    project_id: number
  ): Promise<scarb.Program<Id.Id>[]> {
    const q = new Query(
      `SELECT project_id, name, source_code, sierra, casm FROM program
        WHERE project_id = $1
        ORDER BY id ASC;`,
      [project_id]
    );
    return await this.query(q);
  }

  /**
   * Deletes a single { @see Program } by { @see Project } id and name from
   * the database.
   *
   * @param { number } projectId - Id of the project the program is part of.
   * @param { string } name - Program name.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async deleteProgram(projectId: number, name: string): Promise<void> {
    const q = new Query(
      `DELETE FROM program WHERE project_id = $1 AND name = $2;`,
      [projectId, name]
    );
    await this.query(q);
  }

  /**
   * Atomically deletes multiple { @see Program }s across a single or multiple
   * { @see Project }s as part of a single transaction.
   *
   * @param { { projectId: number, name: string } } programs - Identifiers
   * used to delete each program.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async deletePrograms(
    programs: { projectId: number; name: string }[]
  ): Promise<void> {
    const t = programs.map(
      (program) =>
        new Query(`DELETE FROM program WHERE project_id = $1 AND name = $2;`, [
          program.projectId,
          program.name,
        ])
    );
    await this.transaction(t);
  }

  public async insertDependency(dep: scarb.Dependency<Id.Id>): Promise<void> {
    const q = new Query(`SELECT insert_dependency($1, $2, $3)`, [
      dep.project_id,
      dep.name,
      dep.version,
    ]);
    await this.query(q);
  }

  /**
   * Inserts a single { @see Dependency } into the database.
   *
   * The `version` is updated on `(project_id, name)` conflicts.
   *
   * @param { Dependency<id> } dep - Dependency to insert.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async insertDependencies(
    deps: scarb.Dependency<Id.Id>[]
  ): Promise<void> {
    const t = deps.map(
      (dep) =>
        new Query(`SELECT insert_dependency($1, $2, $3)`, [
          dep.project_id,
          dep.name,
          dep.version,
        ])
    );
    await this.transaction(t);
  }

  /**
   * Retrieves all { @see Dependency } associated to a { @see Project }.
   *
   * > [!WARNING]
   * > This is probably not a good idea and should be replace by a proper
   * > cursor or a limit asap.
   *
   * @param { number } projectId - Id of the project the program is part of.
   *
   * @returns { Dependency<Id.Id>[] } All dependencies associated to a project,
   * if any.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async selectDependencies(
    projectId: number
  ): Promise<scarb.Dependency<Id.Id>[]> {
    const q = new Query(
      `SELECT project_id, name, version FROM dependency
        WHERE project_id = $1
        ORDER BY id ASC;`,
      [projectId]
    );
    return await this.query(q);
  }

  /**
   * Deletes a single { @see Dependency } by { @see Project id } and name from
   * the database.
   *
   * @param { number } projectId - Id of the project the program is part of.
   * @param { string } name - Dependency name.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async deleteDependency(
    projectId: number,
    name: string
  ): Promise<void> {
    const q = new Query(
      `DELETE FROM dependency WHERE project_id = $1 AND name = $2;`,
      [projectId, name]
    );
    await this.query(q);
  }

  /**
   * Atomically deletes multiple { @see Dependency } across a single or
   * multiple { @see Project }s as part of a single transaction.
   *
   * @param { { projectId: number, name: string } } deps - Identifiers
   * used to delete each dependency.
   *
   * @throws { DatabaseError } If a database operation fails.
   */

  public async deleteDependencies(
    deps: { projectId: number; name: string }[]
  ): Promise<void> {
    const t = deps.map(
      (dep) =>
        new Query(
          `DELETE FROM dependency WHERE project_id = $1 AND name = $2;`,
          [dep.projectId, dep.name]
        )
    );
    await this.transaction(t);
  }

  /**
   * Atomically updates compilation info for multiple { @see Program }s as
   * part of a single transaction.
   *
   * @param { string[] } programNames - Names used to identify each program.
   * @param { string[] } sierraFiles - Sierra code for each program.
   * @param { string[] } casmFiles - Casm code for each program.
   *
   * @throws { DatabaseError } If a database operation fails.
   */

  public async saveCompilationResults(
    programNames: string[],
    sierraFiles: string[],
    casmFiles: string[]
  ): Promise<void> {
    const t = programNames.map((name, index) => {
      return new Query(
        `UPDATE program SET sierra = $1, casm = $2 WHERE name = $3;`,
        [
          JSON.stringify(sierraFiles[index]),
          JSON.stringify(casmFiles[index]),
          name,
        ]
      );
    });

    await this.transaction(t);
  }

  /**
   * Saves the result of executing a { @see Project }.
   *
   * @param { number } projectId - Id of the project being executed.
   * @param { Buffer } trace - Execution trace (result of execution).
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async saveExecutionResults(
    projectId: number,
    trace: Buffer
  ): Promise<void> {
    const q = new Query(
      `UPDATE PROJECT SET execution_trace = $1 WHERE id = $2;`,
      [trace, projectId]
    );
    await this.query(q);
  }

  /**
   * Saves a { @see Project's } proof.
   *
   * @param { number } projectId - Id of the project being executed.
   * @param { string } proof - Project proof
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  public async saveProof(projectId: number, proof: string): Promise<void> {
    const q = new Query(`UPDATE PROJECT SET proof = $1 WHERE id = $2;`, [
      JSON.stringify(proof),
      projectId,
    ]);
    await this.query(q);
  }

  /**
   * Saves that a { @see Project }'s proof has been verified.
   *
   * @param { number } projectId - Id of the project being executed.
   * @param { boolean } verified - Whether the project has been verified.
   *
   * @throws { DatabaseError } If a database operation fails.
   */

  public async saveVerify(projectId: number, verified: boolean): Promise<void> {
    const q = new Query(`UPDATE PROJECT SET verified = $1 WHERE id = $2`, [
      verified,
      projectId,
    ]);
    await this.query(q);
  }
}
