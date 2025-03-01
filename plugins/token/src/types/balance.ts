/**
 * Parameters for retrieving own account balance
 * @property {string} symbol - The token symbol to check balance for
 */
export type GetOwnBalanceParams = {
  symbol: string;
};

/**
 * Parameters for retrieving balance of a specific account
 * @property {string} accountAddress - The address of the account to check
 * @property {string} assetSymbol - The token symbol to check balance for
 */
export type GetBalanceParams = {
  accountAddress: string;
  assetSymbol: string;
};
