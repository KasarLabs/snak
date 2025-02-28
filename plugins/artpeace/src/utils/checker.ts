import { WorldType } from '../types/WorldType';
import { ColorAnalyzer } from './colors';

/**
 * Validates and processes parameters for placing pixels on ArtPeace canvas
 * @class Checker
 */
export class Checker {
  private world: WorldType;
  private colors: string[];
  private hexColors: string[];

  /**
   * Creates a Checker instance
   * @param param World identifier (string name or numeric ID)
   */
  constructor(private param: string | number) {}

  /**
   * Validates and retrieves world ID
   * @returns Promise resolving to numeric world ID
   * @throws Error if world validation fails
   */
  async checkWorld(): Promise<number> {
    try {
      let id: number;
      if (typeof this.param === 'string') {
        const response = await fetch(
          `https://api.art-peace.net/get-world-id?worldName=${this.param}`
        );
        if (!response.ok)
          throw new Error(`HTTP Error status: ${response.status}`);

        const data = await response.json();
        id = data.data;
      } else id = this.param;

      const response = await fetch(
        `https://api.art-peace.net/get-world?worldId=${id}`
      );
      if (!response.ok)
        throw new Error(`HTTP Error status: ${response.status}`);

      const data = await response.json();
      this.world = data.data;
      return this.world.worldId;
    } catch (error) {
      throw new Error(
        error.message
          ? error.message
          : 'Error when check the world ID for artpeace'
      );
    }
  }

  /**
   * Converts 2D coordinates to 1D position and validates bounds
   * @param x X-coordinate
   * @param y Y-coordinate
   * @returns Promise resolving to 1D position
   * @throws Error if position is out of bounds
   */
  async checkPosition(x: number, y: number): Promise<number> {
    try {
      if (x > this.world.width) {
        throw new Error('Bad Position');
      } else if (y > this.world.height) {
        throw new Error('Bad Position.');
      }
      return x + y * this.world.width;
    } catch (error) {
      throw new Error(
        error.message
          ? error.message
          : 'Error when check the position for artpeace'
      );
    }
  }

  /**
   * Fetches and processes the color palette for the current world.
   *
   * @returns {Promise<void>}
   * @throws {Error} If the API request fails or returns a non-OK status
   */
  async getColors() {
    try {
      const response = await fetch(
        `https://api.art-peace.net/get-worlds-colors?worldId=${this.world.worldId}`
      );
      if (!response.ok) {
        throw new Error(
          `Error during get world colors fetch: HTTP Error status: ${response.status}`
        );
      }
      const data = await response.json();
      const allHexColor: string[] = data.data;
      this.hexColors = allHexColor;
      const allColor: string[] = allHexColor.map((cleanColor) =>
        ColorAnalyzer.analyzeColor(cleanColor)
      );
      this.colors = allColor;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Validates color and converts it to the corresponding index
   * @param color Color value (hex or name)
   * @returns Promise resolving to color index as string
   * @throws Error if color is not available in the world
   */
  async checkColor(color: string): Promise<string> {
    try {
      const cleanColor = color.charAt(0) === '#' ? color.substring(1) : color;
      const isHex = this.hexColors.indexOf(cleanColor);
      if (isHex != -1) return `${isHex}`;

      const numColor = parseInt(color);
      if (numColor < 255 && numColor <= this.hexColors.length) return color;

      const index: number = this.colors.indexOf(cleanColor);
      if (index === -1)
        throw new Error(
          `the color ${cleanColor} is not available in this world `
        );

      return `${index}`;
    } catch (error) {
      throw new Error(
        error.message
          ? error.message
          : 'Error when check the colors for artpeace'
      );
    }
  }

  /**
   * Retrieves the dimensions of the world.
   *
   * @returns {Object} An object containing the world dimensions
   * @returns {number} returns.width - The width of the world
   * @returns {number} returns.height - The height of the world
   */
  getWorldSize(): { width: number; height: number } {
    return {
      width: this.world.width,
      height: this.world.height,
    };
  }
}
