import { installScarb, configureSierraAndCasm } from '../../src/utils/install.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Tests réels pour Scarb', () => {
  const agent = createMockStarknetAgent();
  let testDir : any;

  beforeAll(async () => {
    // Créer un répertoire temporaire pour les tests
    testDir = path.join(process.cwd(), 'test_scarb_project');
    try {
      await fs.mkdir(testDir, { recursive: true });
      console.log(`Répertoire de test créé: ${testDir}`);
    } catch (error) {
      console.log(`Le répertoire existe déjà: ${testDir}`);
    }
  });

  afterAll(async () => {
    // Option pour nettoyer le répertoire de test après
    // Décommentez si vous souhaitez supprimer le répertoire après les tests

    try {
      await fs.rm(testDir, { recursive: true, force: true });
      console.log(`Répertoire de test supprimé: ${testDir}`);
    } catch (error) {
      console.error(`Erreur lors de la suppression du répertoire: ${error.message}`);
    }

  });

  it('devrait installer Scarb si nécessaire', async () => {
    const result = await installScarb(agent, {});
    const parsedResult = JSON.parse(result);
    
    console.log('Résultat de l\'installation de Scarb:', parsedResult);
    expect(parsedResult.status).toBe('success');
    
    // Le message peut indiquer que Scarb est déjà installé ou qu'il a été installé avec succès
    expect(parsedResult.message).toMatch(/(already installed|installed successfully)/);
  }, 120000); // Timeout plus long car l'installation peut prendre du temps

  it('devrait initialiser un projet et configurer Sierra et CASM', async () => {
    // Initialiser un projet avec scarb init
    // Note: nous utilisons directement la commande shell pour initialiser le projet
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
      // Exécuter scarb init pour créer un nouveau projet
      await execAsync(`cd ${testDir} && scarb init --name test_project`);
      console.log('Projet Scarb initialisé');
      
      // Configurer Sierra et CASM
      const result = await configureSierraAndCasm(agent, { path: testDir });
      const parsedResult = JSON.parse(result);
      
      console.log('Résultat de la configuration Sierra et CASM:', parsedResult);
      expect(parsedResult.status).toBe('success');
      
      // Vérifier le contenu du fichier Scarb.toml
      const tomlPath = path.join(testDir, 'Scarb.toml');
      const tomlContent = await fs.readFile(tomlPath, 'utf8');
      
      console.log('Contenu de Scarb.toml après configuration:', tomlContent);
      expect(tomlContent).toContain('[[target.starknet-contract]]');
      expect(tomlContent).toContain('sierra = true');
      expect(tomlContent).toContain('casm = true');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation ou de la configuration:', error);
      throw error;
    }
  }, 30000); // Timeout de 30 secondes pour cette opération
});