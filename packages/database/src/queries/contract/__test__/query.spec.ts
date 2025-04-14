import { connect, shutdown } from "../../../database.js";
import { Id } from "../../common.js";
import { contract } from '../queries.js';

beforeAll(async () => {
	await connect();
});

afterAll(async () => {
	await shutdown();
});

describe('Contract database initialization', () => {
	it('Should create tables', async () => {
		await expect(contract.init()).resolves.toBeUndefined();
	});

	it('Should be indempotent', async () => {
		await expect(contract.init()).resolves.toBeUndefined();
	});
});

describe('Contract table', () => {
	it('Should handle insertions', async () => {
		const c1: contract.Contract = {
			class_hash: "0xdeadbeef",
			declare_tx_hash: "0xdab"
		};
		await expect(contract.insertContract(c1)).resolves.toBeUndefined();

		const c2: contract.Contract = {
			class_hash: "0xdad",
			declare_tx_hash: "0xdababe"
		};
		await expect(contract.insertContract(c2)).resolves.toBeUndefined();
	});

	it('Should reject duplicates', async () => {
		const c1: contract.Contract = {
			class_hash: "0xdeadbeef",
			declare_tx_hash: "0xdab"
		};
		await expect(contract.insertContract(c1)).rejects.toThrow();
	});

	it('Should handle retrievals', async () => {
		const class_hash = "0xdeadbeef";
		const c: contract.Contract<Id.Id> = {
			id: 1,
			class_hash,
			declare_tx_hash: "0xdab"
		};
		await expect(contract.selectContract(class_hash)).resolves.toEqual(c);
	});


	it('Should handle deletions', async () => {
		const class_hash = "0xdad";
		await expect(contract.deleteContract(class_hash)).resolves.toBeUndefined();
		await expect(contract.selectContract(class_hash)).resolves.toBeUndefined();
	});
});

describe('Deployment table', () => {
	it('Should handle insertions', async () => {
		const class_hash = "0xdeadbeef";
		const deployment: contract.Deployment = {
			contract_address: "0xfeed",
			deploy_tx_hash: "0xada"
		};
		await expect(contract.insertDeployment(deployment, class_hash)).resolves.toBeUndefined();
	});

	it('Should reject duplicates', async () => {
		const class_hash = "0xdeadbeef";
		const deployment: contract.Deployment = {
			contract_address: "0xfeed",
			deploy_tx_hash: "0xada"
		};
		await expect(contract.insertDeployment(deployment, class_hash)).rejects.toThrow();
	});

	it('Should handle retrievals', async () => {
		const contract_address = "0xfeed";
		const deployment: contract.Deployment<Id.Id> = {
			id: 1,
			contract_id: 1,
			contract_address,
			deploy_tx_hash: "0xada"
		};
		await expect(contract.selectDeployment(contract_address)).resolves.toEqual(deployment);
	});

	it('Should cascade deletions', async () => {
		const class_hash = "0xdeadbeef";
		const contract_address = "0xfeed";
		await expect(contract.deleteContract(class_hash)).resolves.toBeUndefined();
		await expect(contract.selectDeployment(contract_address)).resolves.toBeUndefined();
	});
})
