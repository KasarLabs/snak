import { Quote, Route } from '@avnu/avnu-sdk';

/**
 * Interface representing the result of a route fetch operation
 * @interface RouteResult
 * @property {('success'|'failure')} status - The status of the route fetch operation
 * @property {Route} [route] - The found trading route (if successful)
 * @property {Quote} [quote] - The associated quote (if successful)
 * @property {string} [error] - Error message (if failed)
 */
export interface RouteResult {
  status: 'success' | 'failure';
  route?: Route;
  quote?: Quote;
  error?: string;
}
