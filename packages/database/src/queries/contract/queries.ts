import { Postgres } from '../../database.js';
import { Id } from '../common.js';

export namespace contract {
  /**
   * Initializes the { @see Contract } and { @see Deployment } tables.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function init(): Promise<void> {
    const t = [
      new Postgres.Query(
        `CREATE TABLE IF NOT EXISTS contract(
            id SERIAL PRIMARY KEY,
            class_hash VARCHAR(100) NOT NULL,
            declare_tx_hash VARCHAR(100),
            UNIQUE(class_hash)
        );`
      ),
      new Postgres.Query(
        `CREATE TABLE IF NOT EXISTS deployment(
          id SERIAL PRIMARY KEY,
          contract_id INTEGER REFERENCES contract(id) ON DELETE CASCADE,
          contract_address VARCHAR(100) NOT NULL,
          deploy_tx_hash VARCHAR(100) NOT NULL,
          UNIQUE(contract_address)
        );`
      ),
    ];
    await Postgres.transaction(t);
  }

  interface ContractBase {
    class_hash: string;
    declare_tx_hash: string;
  }
  interface ContractWithId extends ContractBase {
    id: number;
  }

  /**
   * A Cairo contract declared at a `tx_hash` and derived from a unique class
   * (`class_hash`).
   *
   * @field { number } [id] - Contract id in db (optional).
   * @field { string } class_hash - Class hash from which the contract is derived.
   * @field { string } declare_tx_hash - Hash of the tx which declared this contract.
   */
  export type Contract<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? ContractWithId
    : ContractBase;

  /**
   * Inserts a new { @see Contract } into the database.
   *
   * @param { Contract } contract - Contract to insert
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function insertContract(contract: Contract): Promise<void> {
    const q = new Postgres.Query(
      `INSERT INTO contract(
        class_hash,
        declare_tx_hash
      ) VALUES (
        $1,
        $2
      )`,
      [contract.class_hash, contract.declare_tx_hash]
    );
    await Postgres.query(q);
  }

  /**
   * Selects a { @see Contract } from the database by `class_hash`.
   *
   * @param { string } classHash - Class hash from which the contract is derived.
   *
   * @returns { Contract<Id.Id> | undefined } - Contract associated to the `class_hash`, if it exists.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function selectContract(
    classHash: string
  ): Promise<Contract<Id.Id> | undefined> {
    const q = new Postgres.Query(
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
    const q_res = await Postgres.query<Contract<Id.Id>>(q);
    return q_res ? q_res[0] : undefined;
  }

  /**
   * Selects all { @see Contract } from the database.
   *
   * > [!WARNING]
   * > This is probably not a good idea and should be replace by a proper
   * > cursor asap.
   *
   * @returns { Contract<Id.Id>[] } All contracts currently stored in db.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function selectContracts(): Promise<Contract<Id.Id>[]> {
    const q = new Postgres.Query(
      `SELECT
        id,
        class_hash,
        declare_tx_hash
      FROM
        contract;`
    );
    return await Postgres.query(q);
  }

  /**
   * Deletes a { @see Contract } from the database, if it exists.
   *
   * @param { string } classHash - Class hash from which the contract is derived.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function deleteContract(classHash: string): Promise<void> {
    const q = new Postgres.Query(
      `DELETE FROM contract WHERE class_hash = $1;`,
      [classHash]
    );
    await Postgres.query(q);
  }

  interface DeploymentBase {
    contract_address: string;
    deploy_tx_hash: string;
  }
  interface DeploymentWithId extends DeploymentBase {
    id: number;
    contract_id: number;
  }

  /**
   * A { @see Contract } deployment on-chain.
   *
   * @field { number } [id] - Deployment id in db (optional).
   * @field { number } [contract_id] - Related contract id in db (optional).
   * @field { string } [contract_address] - On-chain address of the deployed contract.
   * @field { string } [deploy_tx_hash] - Hash of the deploy Postgres.transaction.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export type Deployment<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? DeploymentWithId
    : DeploymentBase;

  /**
   * Inserts a new { @see Deployment } into the database.
   *
   * @param { Deployment } deployment - Contract deployment to insert.
   * @param { string } classHash - Class hash of the contract being deployed.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function insertDeployment(
    deployment: Deployment,
    classHash: string
  ): Promise<void> {
    const q = new Postgres.Query(
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
    await Postgres.query(q);
  }

  /**
   * Selects a { @see Deployment } from the database by `contract_address`.
   *
   * @param { string} contractAddress - On-chain address of the deployed contract.
   *
   * @returns { Deployment<Id.Id> | undefined } - Deployment associated to the `contract_address`, if it exists.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function selectDeployment(
    contractAddress: string
  ): Promise<Deployment<Id.Id> | undefined> {
    const q = new Postgres.Query(
      `SELECT \
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
    const q_res = await Postgres.query<Deployment<Id.Id>>(q);
    return q_res ? q_res[0] : undefined;
  }

  /**
   * Selects all { @see Deployment } of a given contract from the database.
   *
   * > [!WARNING]
   * > This is probably not a good idea and should be replace by a proper
   * > cursor asap.
   *
   * @param { string } classHash - Class hash of the deployed contract.
   *
   * @returns { Deployment<Id.Id>[] } - All deployments associated to this contract.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function selectDeployments(
    classHash: string
  ): Promise<Deployment<Id.Id>[]> {
    const q = new Postgres.Query(
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
    return await Postgres.query(q);
  }
}
