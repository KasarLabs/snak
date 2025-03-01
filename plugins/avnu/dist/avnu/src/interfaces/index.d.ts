import { Quote, Route } from '@avnu/avnu-sdk';
export interface RouteResult {
    status: 'success' | 'failure';
    route?: Route;
    quote?: Quote;
    error?: string;
}
