import { query, transaction, Query } from "../../database.js"
import { DatabaseError } from "../../error.js";

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
			)
		];
		await transaction(t);
	}

	export interface Project {
		id?: number,
		name: string,
		type: 'contract' | 'cairo_program'
	}
	export async function insertProject(project: Project): Promise<void> {
		const q = new Query(
			`INSERT INTO project(name, type) VALUES
			($1, $2)
			ON CONFLICT (name)
			DO NOTHING;`,
			[project.name, project.type]
		);
		await query(q);
	}
	export async function selectProject(name: string): Promise<Project | undefined> {
		const q = new Query(
			`SELECT id, name, type FROM project WHERE name = $1;`,
			[name]
		);
		const q_res = await query<Project>(q)
		return q_res ? q_res[0] : undefined;
	}
	export async function deleteProject(name: string): Promise<void> {
		const q = new Query(
			`DELETE FROM project WHERE name = $1`,
			[name]
		);
		await query(q);
	}

	// FIXME: all program functions should be done with a project NAME to guarantee transactionality.
	export interface Program {
		project_id?: number,
		name: string,
		source_code: string,
		sierra?: string | null, // FIXME: we can do better than maybe null by leveraging generics
		casm?: string | null
	}
	export async function insertProgram(program: Program): Promise<void> {
		const q = new Query(
			`INSERT INTO program(project_id, name, source_code) VALUES
			($1, $2, $3)
			ON CONFLICT (project_id, name)
			DO UPDATE SET source_code = $3;`,
			[program.project_id, program.name, program.source_code]
		);
		await query(q);
	}
	export async function selectProgram(project_id: number, program_name: string): Promise<Program | undefined> {
		const q = new Query(
			`SELECT project_id, name, source_code, sierra, casm FROM program
			WHERE project_id = $1 AND name = $2
			ORDER BY id ASC;`,
			[project_id, program_name]
		);
		const q_res = await query<Program>(q);
		return q_res ? q_res[0] : undefined;
	}
	export async function selectPrograms(project_id: number): Promise<Program[]> {
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

	export interface Dependency {
		project_id: number,
		name: string;
		version?: string;
	}
	export async function insertDependency(dep: Dependency): Promise<void> {
		const q = new Query(
			`INSERT INTO dependency(project_id, name, version) VALUES
			($1, $2, COALESCE($3, ''))
			ON CONFLICT (project_id, name) 
			DO UPDATE SET version = COALESCE($3, '');`,
			[dep.project_id, dep.name, dep.version]
		);
		await query(q);
	}
	export async function selectDependencies(projectId: number): Promise<Dependency[]> {
		const q = new Query(
			`SELECT project_id, name, version FROM dependency
			WHERE project_id = $1
			ORDER BY id ASC;`,
			[projectId]
		);
		return await query<Dependency>(q);
	}
	export async function deleteDependency(projectId: number, name: string): Promise<void> {
		const q = new Query(
			`DELETE FROM Dependency WHERE project_id = $1 AND name = $2;`,
			[projectId, name]
		);
		await query(q);
	}

	export interface ProjectData {
		id: number;
		name: string;
		type: 'contract' | 'cairo_program';
		programs: Program[];
		dependencies: Dependency[];
		proof?: string;
		verified?: boolean;
	}
	interface ProjectQueryRes {
		project_id: number,
		project_name: string,
		project_type: 'contract' | 'cairo_program';
		program_name?: string,
		program_code?: string,
		dep_name?: string,
		dep_version: string
	};
	export async function retrieveProjectData(name: string): Promise<ProjectData | undefined> {
		const q = new Query(
			`SELECT * FROM(
				SELECT
					project.id AS project_id,
					project.name AS project_name,
					project.type AS project_type,
					program.name AS program_name,
					program.source_code AS program_code,
					NULL AS dep_name,
					NULL as dep_version
				FROM
					project
					LEFT JOIN program ON program.project_id = project.id
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
					NULL AS program_name,
					NULL AS program_code,
					dependency.name AS dep_name,
					dependency.version as dep_version
				FROM
					project
					LEFT JOIN dependency ON dependency.project_id = project.id
				WHERE
					project.name = $1
				ORDER BY dependency.id ASC
			);`,
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

		return acc;
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
}
