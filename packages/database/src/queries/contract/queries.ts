import { query, transaction, Query } from '../../database.js';
import { Id } from '../common.js';

export namespace contract {
  export async function init(): Promise<void> {
    const t = [
      new Query(
        `CREATE TABLE IF NOT EXISTS contract(
					id SERIAL PRIMARY KEY,
					class_hash VARCHAR(100) NOT NULL,
					declare_tx_hash VARCHAR(100),
					UNIQUE(class_hash)
				);`
      ),
      new Query(
        `CREATE TABLE IF NOT EXISTS deployment(
					id SERIAL PRIMARY KEY,
					contract_id INTEGER REFERENCES contract(id) ON DELETE CASCADE,
					contract_address VARCHAR(100) NOT NULL,
					deploy_tx_hash VARCHAR(100) NOT NULL,
					UNIQUE(contract_address)
				);`
      ),
    ];
    await transaction(t);
  }

  interface ContractBase {
    class_hash: string;
    declare_tx_hash: string;
  }
  interface ContractWithId extends ContractBase {
    id: number;
  }
  export type Contract<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? ContractWithId
    : ContractBase;

  export async function insertContract(contract: Contract): Promise<void> {
    const q = new Query(
      `INSERT INTO contract(
				class_hash,
				declare_tx_hash
			) VALUES (
				$1,
				$2
			)`,
      [contract.class_hash, contract.declare_tx_hash]
    );
    await query(q);
  }
  export async function selectContract(
    classHash: string
  ): Promise<Contract<Id.Id> | undefined> {
    const q = new Query(
      `SELECT 
				id, 
				class_hash, 
				declare_tx_hash
			FROM
				contract
			WHERE
				class_hash = $1;`,
      [classHash]
    );
    const q_res = await query<Contract<Id.Id>>(q);
    return q_res ? q_res[0] : undefined;
  }
  export async function selectContracts(): Promise<Contract<Id.Id>[]> {
    const q = new Query(
      `SELECT
				id,
				class_hash,
				declare_tx_hash
			FROM
				contract;`
    );
    return await query(q);
  }
  export async function deleteContract(classHash: string): Promise<void> {
    const q = new Query(`DELETE FROM contract WHERE class_hash = $1;`, [
      classHash,
    ]);
    await query(q);
  }

  interface DeploymentBase {
    contract_address: string;
    deploy_tx_hash: string;
  }
  interface DeploymentWithId extends DeploymentBase {
    id: number;
    contract_id: number;
  }
  export type Deployment<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? DeploymentWithId
    : DeploymentBase;

  export async function insertDeployment(
    deployment: Deployment,
    classHash: string
  ): Promise<void> {
    const q = new Query(
      `INSERT INTO deployment(
				contract_id,
				contract_address,
				deploy_tx_hash
			) VALUES (
				(SELECT id FROM contract WHERE class_hash = $1),
				$2,
				$3
			);`,
      [classHash, deployment.contract_address, deployment.deploy_tx_hash]
    );
    await query(q);
  }
  export async function selectDeployment(
    contractAddress: string
  ): Promise<Deployment<Id.Id> | undefined> {
    const q = new Query(
      `SELECT 
				id,
				contract_id,
				contract_address,
				deploy_tx_hash
			FROM 
				deployment
			WHERE
				contract_address = $1`,
      [contractAddress]
    );
    const q_res = await query<Deployment<Id.Id>>(q);
    return q_res ? q_res[0] : undefined;
  }
  export async function selectDeployments(
    classHash: string
  ): Promise<Deployment<Id.Id>[]> {
    const q = new Query(
      `SELECT
				id,
				contract_id,
				contract_address,
				deploy_tx_hash
			FROM
				deployment
			WHERE
				contract_id = (SELECT id FROM contract WHERE class_hash = $1);
			`,
      [classHash]
    );
    return await query(q);
  }
}
