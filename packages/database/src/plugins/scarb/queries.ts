import { query, transaction, Query } from "../../database.js"
import { DatabaseError } from "../../error.js";

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
				UNIQUE (name)
			);`
		),
		new Query(
			`CREATE TABLE IF NOT EXISTS program(
				id SERIAL PRIMARY KEY,
				project_id INTEGER REFERENCES project(id) ON DELETE CASCADE,
				name VARCHAR(255) NOT NULL,
				source_code TEXT,
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

export interface SchemaProject {
	id?: number,
	name: string,
	type: 'contract' | 'cairo_program'
}
export async function insertProject(project: SchemaProject): Promise<void> {
	const q = new Query(
		`INSERT INTO project(name, type) VALUES
			($1, $2)
			ON CONFLICT (name)
			DO NOTHING;`,
		[project.name, project.type]
	);
	await query(q);
}
export async function selectProject(name: string): Promise<SchemaProject[] | undefined> {
	const q = new Query(
		`SELECT id, name, type FROM project WHERE name = $1;`,
		[name]
	);
	return await query(q);
}

export interface SchemaProgram {
	project_id: number,
	name: string,
	source_code: string
}
export async function insertProgram(program: SchemaProgram): Promise<void> {
	const q = new Query(
		`INSERT INTO program(project_id, name, source_code) VALUES
			($1, $2, $3)
			ON CONFLICT (project_id, name)
			DO UPDATE SET source_code = $3;`,
		[program.project_id, program.name, program.source_code]
	);
	await query(q);
}
export async function selectPrograms(project_id: number): Promise<SchemaProgram[] | undefined> {
	const q = new Query(
		`SELECT project_id, name, source_code FROM program
			WHERE project_id = $1
			ORDER BY id ASC;`,
		[project_id]
	);
	return await query(q);
}

export interface SchemaDependency {
	project_id: number,
	name: string;
	version?: string;
}
export async function insertDependency(dep: SchemaDependency): Promise<void> {
	const q = new Query(
		`INSERT INTO dependency(project_id, name, version) VALUES
			($1, $2, COALESCE($3, ''))
			ON CONFLICT (project_id, name) 
			DO UPDATE SET version = COALESCE($3, '');`,
		[dep.project_id, dep.name, dep.version]
	);
	await query(q);
}
export async function selectDependencies(projectId: number): Promise<SchemaDependency[] | undefined> {
	const q = new Query(
		`SELECT project_id, name, version FROM dependency
			WHERE project_id = $1
			ORDER BY id ASC;`,
		[projectId]
	);
	return await query<SchemaDependency>(q);
}
