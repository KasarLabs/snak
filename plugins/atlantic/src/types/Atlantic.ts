/**
 * Parameters for atlantic impl
 * @property {string} filename - The name of the file you wish to verify or generate the proof of
 */
export type AtlanticParam = {
  filename: string;
};

/**
 * Parameters for verify proof impl
 * @property {string} filename - The name of the file you wish to verify or generate the proof of
 * @property {string} memoryVerification - Type of public memory verification
 */
export type VerifierParam = {
  filename: string;
  memoryVerification: string;
};

/**
 * Interface for atlantic API response
 * @property {string} atlanticQueryId - query id to retrieve the request
 */
export interface AtlanticRes {
  atlanticQueryId: string;
}
