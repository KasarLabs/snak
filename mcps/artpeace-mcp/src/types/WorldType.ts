/**
 * Represents a world/canvas configuration
 * @interface WorldType
 * @property worldId Unique numeric identifier for the world
 * @property name Display name of the world
 * @property uniqueName Unique identifier string for the world
 * @property width Width of the canvas in pixels
 * @property height Height of the canvas in pixels
 */
export interface WorldType {
  worldId: number;
  name: string;
  uniqueName: string;
  width: number;
  height: number;
}
