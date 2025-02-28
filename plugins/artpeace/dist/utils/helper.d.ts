import { placePixelParam } from '../schema';
import { Checker } from './checker';
export declare class ArtpeaceHelper {
    static DEFAULT_COLOR: string;
    static generateRandomPosition(width: number, height: number): {
        xPos: number;
        yPos: number;
    };
    static validateAndFillDefaults(param: placePixelParam, checker: Checker): Promise<{
        position: number;
        color: string;
    }>;
}
