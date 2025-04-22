import { DatabaseCredentials } from '../../../utils/database.js';
import { Postgres } from '../../../database.js';
import { contractQueries, contract } from '../queries.js';

const databasecredentials: DatabaseCredentials = {
  user: process.env.POSTGRES_USER as string,
  host: process.env.POSTGRES_HOST as string,
  database: process.env.POSTGRES_DB as string,
  password: process.env.POSTGRES_PASSWORD as string,
  port: parseInt(process.env.POSTGRES_PORT || '5454'),
};

let _contract = new contractQueries(databasecredentials);
beforeAll(async () => {
  await _contract.connect(
    process.env.POSTGRES_USER as string,
    process.env.POSTGRES_HOST as string,
    process.env.POSTGRES_DB as string,
    process.env.POSTGRES_PASSWORD as string,
    parseInt(process.env.POSTGRES_PORT || '5454')
  );
});

afterAll(async () => {
  await _contract.shutdown();
});
describe('Contract database initialization', () => {
  it('Should create tables', async () => {
    await expect(_contract.init()).resolves.toBeUndefined();
  });

  it('Should be indempotent', async () => {
    await expect(_contract.init()).resolves.toBeUndefined();
  });
});

describe('Contract table', () => {
  it('Should handle insertions', async () => {
    const c1: contract.Contract = {
      class_hash: '0xdeadbeef',
      declare_tx_hash: '0xdab',
    };

    await expect(_contract.insertContract(c1)).resolves.toBeUndefined();

    const c2: contract.Contract = {
      class_hash: '0xdad',
      declare_tx_hash: '0xdababe',
    };

    await expect(_contract.insertContract(c2)).resolves.toBeUndefined();
  });

  it('Should reject duplicates', async () => {
    const c1: contract.Contract = {
      class_hash: '0xdeadbeef',
      declare_tx_hash: '0xdab',
    };

    await expect(_contract.insertContract(c1)).rejects.toThrow();
  });

  it('Should handle retrievals', async () => {
    const class_hash = '0xdeadbeef';
    const c: contract.Contract = {
      class_hash,
      declare_tx_hash: '0xdab',
    };

    await expect(_contract.selectContract(class_hash)).resolves.toMatchObject(
      c
    );
  });

  it('Should handle bulk retrievals', async () => {
    const c: contract.Contract[] = [
      {
        class_hash: '0xdeadbeef',
        declare_tx_hash: '0xdab',
      },
      {
        class_hash: '0xdad',
        declare_tx_hash: '0xdababe',
      },
    ];

    await expect(_contract.selectContracts()).resolves.toMatchObject(c);
  });

  it('Should handle deletions', async () => {
    const class_hash = '0xdad';

    await expect(_contract.deleteContract(class_hash)).resolves.toBeUndefined();
    await expect(_contract.selectContract(class_hash)).resolves.toBeUndefined();
  });
});

describe('Deployment table', () => {
  it('Should handle insertions', async () => {
    const class_hash1 = '0xdeadbeef';
    const deployment1: contract.Deployment = {
      contract_address: '0xfeed',
      deploy_tx_hash: '0xada',
    };

    await expect(
      _contract.insertDeployment(deployment1, class_hash1)
    ).resolves.toBeUndefined();

    const class_hash2 = '0xdeadbeef';
    const deployment2: contract.Deployment = {
      contract_address: '0xbeef',
      deploy_tx_hash: '0xdad',
    };
    await expect(
      _contract.insertDeployment(deployment2, class_hash2)
    ).resolves.toBeUndefined();
  });

  it('Should reject duplicates', async () => {
    const class_hash = '0xdeadbeef';
    const deployment: contract.Deployment = {
      contract_address: '0xfeed',
      deploy_tx_hash: '0xada',
    };

    await expect(
      _contract.insertDeployment(deployment, class_hash)
    ).rejects.toThrow();
  });

  it('Should handle retrievals', async () => {
    const contract_address = '0xfeed';
    const deployment: contract.Deployment = {
      contract_address,
      deploy_tx_hash: '0xada',
    };

    await expect(
      _contract.selectDeployment(contract_address)
    ).resolves.toMatchObject(deployment);
  });

  it('Should handle bulk retrievals', async () => {
    const class_hash = '0xdeadbeef';
    const deployments: contract.Deployment[] = [
      {
        contract_address: '0xfeed',
        deploy_tx_hash: '0xada',
      },
      {
        contract_address: '0xbeef',
        deploy_tx_hash: '0xdad',
      },
    ];

    await expect(
      _contract.selectDeployments(class_hash)
    ).resolves.toMatchObject(deployments);
  });

  it('Should cascade deletions', async () => {
    const class_hash = '0xdeadbeef';
    const contract_address = '0xfeed';

    await expect(_contract.deleteContract(class_hash)).resolves.toBeUndefined();
    await expect(
      _contract.selectDeployment(contract_address)
    ).resolves.toBeUndefined();
  });
});
