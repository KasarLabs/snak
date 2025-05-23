import { Postgres } from '../../../database.js';
import { contract } from '../queries.js';

const db_credentials = {
  host: process.env.POSTGRES_HOST as string,
  port: parseInt(process.env.POSTGRES_PORT!) as number,
  user: process.env.POSTGRES_USER as string,
  password: process.env.POSTGRES_PASSWORD as string,
  database: process.env.POSTGRES_DB as string,
};

beforeAll(async () => {
  await Postgres.connect(db_credentials);
});

afterAll(async () => {
  await Postgres.shutdown();
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
      class_hash: '0xdeadbeef',
      declare_tx_hash: '0xdab',
    };
    await expect(contract.insertContract(c1)).resolves.toBeUndefined();

    const c2: contract.Contract = {
      class_hash: '0xdad',
      declare_tx_hash: '0xdababe',
    };
    await expect(contract.insertContract(c2)).resolves.toBeUndefined();
  });

  it('Should reject duplicates', async () => {
    const c1: contract.Contract = {
      class_hash: '0xdeadbeef',
      declare_tx_hash: '0xdab',
    };
    await expect(contract.insertContract(c1)).rejects.toThrow();
  });

  it('Should handle retrievals', async () => {
    const class_hash = '0xdeadbeef';
    const c: contract.Contract = {
      class_hash,
      declare_tx_hash: '0xdab',
    };
    await expect(contract.selectContract(class_hash)).resolves.toMatchObject(c);
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
    await expect(contract.selectContracts()).resolves.toMatchObject(c);
  });

  it('Should handle deletions', async () => {
    const class_hash = '0xdad';
    await expect(contract.deleteContract(class_hash)).resolves.toBeUndefined();
    await expect(contract.selectContract(class_hash)).resolves.toBeUndefined();
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
      contract.insertDeployment(deployment1, class_hash1)
    ).resolves.toBeUndefined();

    const class_hash2 = '0xdeadbeef';
    const deployment2: contract.Deployment = {
      contract_address: '0xbeef',
      deploy_tx_hash: '0xdad',
    };
    await expect(
      contract.insertDeployment(deployment2, class_hash2)
    ).resolves.toBeUndefined();
  });

  it('Should reject duplicates', async () => {
    const class_hash = '0xdeadbeef';
    const deployment: contract.Deployment = {
      contract_address: '0xfeed',
      deploy_tx_hash: '0xada',
    };
    await expect(
      contract.insertDeployment(deployment, class_hash)
    ).rejects.toThrow();
  });

  it('Should handle retrievals', async () => {
    const contract_address = '0xfeed';
    const deployment: contract.Deployment = {
      contract_address,
      deploy_tx_hash: '0xada',
    };
    await expect(
      contract.selectDeployment(contract_address)
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
    await expect(contract.selectDeployments(class_hash)).resolves.toMatchObject(
      deployments
    );
  });

  it('Should cascade deletions', async () => {
    const class_hash = '0xdeadbeef';
    const contract_address = '0xfeed';
    await expect(contract.deleteContract(class_hash)).resolves.toBeUndefined();
    await expect(
      contract.selectDeployment(contract_address)
    ).resolves.toBeUndefined();
  });
});
