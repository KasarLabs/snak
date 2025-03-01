/**
 * Represents RGB color values
 * @interface RGB
 * @property r Red component (0-255)
 * @property g Green component (0-255)
 * @property b Blue component (0-255)
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Represents HSV (Hue, Saturation, Value) color values
 * @interface HSV
 * @property h Hue angle in degrees (0-360)
 * @property s Saturation percentage (0-1)
 * @property v Value/Brightness percentage (0-1)
 */
export interface HSV {
  h: number;
  s: number;
  v: number;
}
