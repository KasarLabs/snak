import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { RouteSchemaType } from '../../../fibrous/src/schema';
import { RouteResult } from '../interfaces';
export declare class RouteFetchService {
    private tokenService;
    constructor();
    initialize(): Promise<void>;
    fetchRoute(params: RouteSchemaType, agent: StarknetAgentInterface): Promise<RouteResult>;
}
export declare const getRoute: (agent: StarknetAgentInterface, params: RouteSchemaType) => Promise<RouteResult>;
