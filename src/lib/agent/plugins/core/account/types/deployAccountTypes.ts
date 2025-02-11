import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';

/**
 * Parameters for deploying an OpenZeppelin account
 * @property {string} publicKey - The public key of the account
 * @property {string} privateKey - The private key of the account
 */
export type DeployOZAccountParams = {
  publicKey: string;
  privateKey: string;
  precalculate_address: string;
};

/**
 * Parameters for deploying an Argent account
 * @property {string} publicKeyAX - The Argent X public key
 * @property {string} privateKeyAX - The Argent X private key
 */
export type DeployArgentParams = {
  publicKeyAX: string;
  privateKeyAX: string;
  precalculate_address: string;
};

/**
 * Parameters for deploying a Braavos account
 * @property {string} publicKey - The public key of the account
 * @property {string} privateKey - The private key of the account
 */
export type DeployBraavosParams = {
  publicKey: string;
  privateKey: string;
  precalculate_address: string;
}

/**
 * Parameters for deploying a Braavos account
 * @property {string} publicKey - The public key of the account
 * @property {string} privateKey - The private key of the account
 */
export type DeployOKXParams = {
  publicKey: string;
  privateKey: string;
  precalculate_address: string;
}
