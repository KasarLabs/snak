// __test__/scarb/install.spec.ts
import { installScarb } from '../../src/actions/installScarb.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import * as environmentModule from '../../src/utils/environment.js';


describe('Tests d\'installation de Scarb', () => {
  const agent = createMockStarknetAgent();

  
  it('devrait détecter que Scarb est déjà installé', async () => {
    // Configuration réelle - utile si Scarb est déjà installé sur la machine de test
    const result = await installScarb(agent, {});
    const parsedResult = JSON.parse(result);
    
    console.log('Résultat de la vérification de Scarb:', parsedResult);
    
    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toMatch(/(already installed|installed successfully)/);
  });

});