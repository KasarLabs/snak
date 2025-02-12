import { RpcProvider } from 'starknet';
import * as fs from 'fs';
import { CreateOKXAccountSignature } from 'src/lib/agent/plugins/okx/actions/createAccount';
import { DeployOKXAccountSignature } from 'src/lib/agent/plugins/okx/actions/deployAccount';

describe('OKX Account Creation and Deployment', () => {
    let provider: RpcProvider;

    beforeAll(() => {
        provider = new RpcProvider({ 
            nodeUrl: process.env.STARKNET_RPC_URL
        });
    });

    it('should create a new account and save details', async () => {
        if (process.env.RUN_DEPLOYMENT_TEST) {
            return;
        }

        const result = await CreateOKXAccountSignature();
        
        const data = JSON.parse(result);

        if (data.status !== 'success') {
            console.log(data.error);
        }
        expect(data.status).toBe('success');
        expect(data.transaction_type).toBe('CREATE_ACCOUNT');
        expect(data.wallet).toBe('OKX');
    
        expect(data.publicKey).toMatch(/^0x[a-fA-F0-9]+$/);
        expect(data.privateKey).toMatch(/^0x[a-fA-F0-9]+$/);
        expect(data.contractAddress).toMatch(/^0x[a-fA-F0-9]+$/);

        console.log('\n=== DÉTAILS DU COMPTE ===');
        console.log('Adresse:', data.contractAddress);
        console.log('Clé publique:', data.publicKey);
        console.log('Clé privée:', data.privateKey);
        console.log('\nFrais de déploiement estimés:', data.deployFee.overall_fee);
        
    }, 30000); // Timeout de 30 secondes


    it('should deploy the account', async () => {
        if (!process.env.RUN_DEPLOYMENT_TEST) {
            console.log('Test de déploiement ignoré. Définissez RUN_DEPLOYMENT_TEST=true pour l\'exécuter');
            return;
        }
        
        const accountDetails = {
            contractAddress: '0x4570109d7cf87789cc3673fa568f9c92eb74447974dce0907f4150ad87bb858',
            publicKey: '0x3108d02cde928366314aa9bec262cea359f7272e2a7717f795e09cfe17df6d0',
            privateKey: '0x418854677c'
        }
        
        console.log('\nDéploiement du compte...');
        const result = await DeployOKXAccountSignature(accountDetails);
        
        const deployResult = JSON.parse(result);
        expect(deployResult.status).toBe('success');
        
        if (deployResult.status === 'success') {
            console.log('Compte déployé avec succès!');
            console.log('Hash de transaction:', deployResult.transactionHash);
        } else {
            console.error('Échec du déploiement:', deployResult.error);
        }
    }, 300000); // Timeout de 5 minutes pour le déploiement
});