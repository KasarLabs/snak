import { placePixelParam } from '../schema';
import { Checker } from './checker';

/**
 * Helper class for handling pixel placement and position validation in an art system
 */
export class ArtpeaceHelper {
  /** Default color value for pixels */
  static DEFAULT_COLOR = 'black';

  /**
   * Generates a random position within the specified dimensions
   * @param width - The maximum width boundary
   * @param height - The maximum height boundary
   * @returns An object containing random x and y coordinates
   */
  static generateRandomPosition(
    width: number,
    height: number
  ): { xPos: number; yPos: number } {
    return {
      xPos: Math.floor(Math.random() * width),
      yPos: Math.floor(Math.random() * height),
    };
  }

  /**
   * Validates and fills missing parameters with default values
   * @param param - The pixel placement parameters
   * @param param.canvasId - Optional canvas identifier
   * @param param.xPos - Optional x coordinate
   * @param param.yPos - Optional y coordinate
   * @param param.color - Optional color value
   * @returns A promise resolving to an object containing validated id, position and color
   */
  static async validateAndFillDefaults(
    param: placePixelParam,
    checker: Checker
  ): Promise<{ position: number; color: string }> {
    const { width, height } = checker.getWorldSize();
    const randomPos = this.generateRandomPosition(width, height);
    const position = await checker.checkPosition(
      param.xPos ?? randomPos.xPos,
      param.yPos ?? randomPos.yPos
    );
    const color = await checker.checkColor(param.color ?? this.DEFAULT_COLOR);

    return {
      position,
      color,
    };
  }
}
