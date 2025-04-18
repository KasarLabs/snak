import { query, transaction, Query } from "../../database.js"
import { Id } from "../common.js";

export namespace scarb {
	/**
	 * @throws { DatabaseError }
	 */
	export async function init(): Promise<void> {
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
			)
		];
		await transaction(t);
	}

	interface ProjectBase {
		name: string,
		type: 'contract' | 'cairo_program',
		execution_trace?: string,
		proof?: string;
		verified?: boolean;
	}
	interface ProjectWithId extends ProjectBase {
		id: number
	}
	export type Project<HasId extends Id = Id.NoId> =
		HasId extends Id.Id ? ProjectWithId : ProjectBase;
	export async function insertProject(project: Project): Promise<void> {
		const q = new Query(
			`SELECT insert_project($1, $2);`,
			[project.name, project.type]
		);
		await query(q);
	}
	export async function selectProject(name: string): Promise<Project<Id.Id> | undefined> {
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
		const q_res = await query<Project<Id.Id>>(q)
		return q_res ? q_res[0] : undefined;
	}
	export async function selectProjects(): Promise<Project[]> {
		const q = new Query(`SELECT id, name, type FROM project`);
		return await query(q);
	}
	export async function deleteProject(name: string): Promise<void> {
		const q = new Query(
			`DELETE FROM project WHERE name = $1`,
			[name]
		);
		await query(q);
	}

	export interface ProjectData {
		id: number;
		name: string;
		type: 'contract' | 'cairo_program';
		programs: Program<Id.Id>[];
		dependencies: Dependency<Id.Id>[];
		execution_trace?: string,
		proof?: string;
		verified?: boolean;
	}
	interface ProjectQueryRes {
		project_id: number,
		project_name: string,
		project_type: 'contract' | 'cairo_program';
		project_trace?: string,
		project_proof?: string,
		project_verif?: boolean,
		program_name?: string,
		program_code?: string,
		dep_name?: string,
		dep_version?: string
	};
	export async function initProject(
		project: Project,
		programs: Program[],
		dependencies: Dependency[]
	): Promise<ProjectData | undefined> {
		const t = [
			new Query(
				`SELECT init_project($1, $2, $3)`,
				[
					JSON.stringify(project),
					JSON.stringify(programs),
					JSON.stringify(dependencies)
				]
			),
			new Query(
				`SELECT * FROM retrieve_project($1)`,
				[project.name]
			)
		];
		const t_res = await transaction<ProjectQueryRes>(t);

		if (t_res.length) {
			const init: ProjectData = {
				id: 0,
				name: '',
				type: 'contract',
				programs: [],
				dependencies: [],
			};
			return t_res.reduce<ProjectData>(reduce, init);
		}
	}
	export async function retrieveProjectData(name: string): Promise<ProjectData | undefined> {
		const q = new Query(
			`SELECT * FROM retrieve_project($1);`,
			[name]
		);

		const q_res = await query<ProjectQueryRes>(q);

		if (q_res.length) {
			const init: ProjectData = {
				id: 0,
				name: '',
				type: 'contract',
				programs: [],
				dependencies: [],
			};
			return q_res.reduce<ProjectData>(reduce, init);
		}
	}
	function reduce(acc: ProjectData, next: ProjectQueryRes): ProjectData {
		acc.id = next.project_id;
		acc.name = next.project_name;
		acc.type = next.project_type;

		if (next.program_name) {
			acc.programs.push({
				project_id: next.project_id,
				name: next.program_name,
				source_code: next.program_code!
			});
		}

		if (next.dep_name) {
			acc.dependencies.push({
				project_id: next.project_id,
				name: next.dep_name,
				version: next.dep_version
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

	interface ProgramBase {
		name: string,
		source_code: string,
		sierra?: string | null, // FIXME: we can do better than maybe null by leveraging generics
		casm?: string | null
	}
	interface ProgramWithId extends ProgramBase {
		project_id: number,
	}
	export type Program<HasId extends Id = Id.NoId> =
		HasId extends Id.Id ? ProgramWithId : ProgramBase;
	export async function insertProgram(program: Program<Id.Id>): Promise<void> {
		const q = new Query(
			`SELECT insert_program($1, $2, $3);`,
			[program.project_id, program.name, program.source_code]
		);
		await query(q);
	}
	export async function insertPrograms(programs: Program<Id.Id>[]): Promise<void> {
		const t = programs.map((program) => new Query(
			`SELECT insert_program($1, $2, $3);`,
			[program.project_id, program.name, program.source_code]
		));
		await transaction(t);
	}
	export async function selectProgram(project_id: number, program_name: string): Promise<Program<Id.Id> | undefined> {
		const q = new Query(
			`SELECT project_id, name, source_code, sierra, casm FROM program
			WHERE project_id = $1 AND name = $2
			ORDER BY id ASC;`,
			[project_id, program_name]
		);
		const q_res = await query<Program<Id.Id>>(q);
		return q_res ? q_res[0] : undefined;
	}
	export async function selectPrograms(project_id: number): Promise<Program<Id.Id>[]> {
		const q = new Query(
			`SELECT project_id, name, source_code, sierra, casm FROM program
			WHERE project_id = $1
			ORDER BY id ASC;`,
			[project_id]
		);
		return await query(q);
	}
	export async function deleteProgram(projectId: number, name: string): Promise<void> {
		const q = new Query(
			`DELETE FROM program WHERE project_id = $1 AND name = $2;`,
			[projectId, name]
		);
		await query(q);
	}
	export async function deletePrograms(
		programs: { projectId: number, name: string }[]
	): Promise<void> {
		const t = programs.map(
			(program) => new Query(
				`DELETE FROM program WHERE project_id = $1 AND name = $2;`,
				[program.projectId, program.name]
			)
		);
		await transaction(t);
	}

	interface DepBase {
		name: string;
		version?: string;
	}
	interface DepWithId extends DepBase {
		project_id: number,
	}
	export type Dependency<HasId extends Id = Id.NoId> =
		HasId extends Id.Id ? DepWithId : DepBase;
	export async function insertDependency(dep: Dependency<Id.Id>): Promise<void> {
		const q = new Query(
			`SELECT insert_dependency($1, $2, $3)`,
			[dep.project_id, dep.name, dep.version]
		);
		await query(q);
	}
	export async function insertDependencies(deps: Dependency<Id.Id>[]): Promise<void> {
		const t = deps.map((dep) => new Query(
			`SELECT insert_dependency($1, $2, $3)`,
			[dep.project_id, dep.name, dep.version]
		));
		await transaction(t);
	}
	export async function selectDependencies(projectId: number): Promise<Dependency<Id.Id>[]> {
		const q = new Query(
			`SELECT project_id, name, version FROM dependency
			WHERE project_id = $1
			ORDER BY id ASC;`,
			[projectId]
		);
		return await query(q);
	}
	export async function deleteDependency(projectId: number, name: string): Promise<void> {
		const q = new Query(
			`DELETE FROM dependency WHERE project_id = $1 AND name = $2;`,
			[projectId, name]
		);
		await query(q);
	}
	export async function deleteDependencies(
		deps: { projectId: number, name: string }[]
	): Promise<void> {
		const t = deps.map(
			(dep) => new Query(
				`DELETE FROM dependency WHERE project_id = $1 AND name = $2;`,
				[dep.projectId, dep.name]
			)
		);
		await transaction(t);
	}

	export async function saveCompilationResults(
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
					name
				]
			);
		});

		await transaction(t);
	}

	export async function saveExecutionResults(
		projectId: number,
		trace: Buffer,
	): Promise<void> {
		const q = new Query(
			`UPDATE PROJECT SET execution_trace = $1 WHERE id = $2;`,
			[trace, projectId]
		);
		await query(q);
	}

	export async function saveProof(
		projectId: number,
		proof: string
	): Promise<void> {
		const q = new Query(
			`UPDATE PROJECT SET proof = $1 WHERE id = $2;`,
			[JSON.stringify(proof), projectId]
		);
		await query(q);
	}

	export async function saveVerify(
		projectId: number,
		verified: boolean
	): Promise<void> {
		const q = new Query(
			`UPDATE PROJECT SET verified = $1 WHERE id = $2`,
			[verified, projectId]
		);
		await query(q);
	}
}
