import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { RouteResponse } from 'fibrous-router-sdk';
import { RouteSchemaType } from '../schema';
interface RouteResult {
    status: 'success' | 'failure';
    route?: RouteResponse | null;
    error?: string;
}
export declare class RouteFetchService {
    private tokenService;
    private router;
    constructor();
    initialize(): Promise<void>;
    fetchRoute(params: RouteSchemaType): Promise<RouteResult>;
}
export declare const getRouteFibrous: (agent: StarknetAgentInterface, params: RouteSchemaType) => Promise<RouteResult>;
export {};
