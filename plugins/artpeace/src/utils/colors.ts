import { HSV, RGB } from '../types/ColorType';

/**
 * Analyzes and converts colors between different formats (HEX, RGB, HSV)
 * @class ColorAnalyzer
 */
export class ColorAnalyzer {
  private static LIGHT_THRESHOLD = 0.7;
  private static DARK_THRESHOLD = 0.3;
  private static WHITE_THRESHOLD = 245;
  private static BLACK_THRESHOLD = 10;
  private static GRAY_DIFFERENCE_THRESHOLD = 15;
  private static SATURATION_THRESHOLD = 0.15;

  /**
   * Analyzes a hex color and returns a human-readable description
   * @param hex Hexadecimal color code
   * @returns String description of the color
   */
  static analyzeColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    const hsv = this.rgbToHsv(rgb);

    if (this.isWhite(rgb)) return 'white';

    if (this.isBlack(rgb)) return 'black';

    if (this.isGray(rgb, hsv)) return 'gray';

    const baseColor = this.getBaseColor(hsv);

    return baseColor;
  }

  /**
   * Determines if a color is gray based on RGB differences and saturation
   */
  private static isGray(rgb: RGB, hsv: HSV): boolean {
    const maxDiff = Math.max(
      Math.abs(rgb.r - rgb.g),
      Math.abs(rgb.g - rgb.b),
      Math.abs(rgb.b - rgb.r)
    );

    return (
      maxDiff <= this.GRAY_DIFFERENCE_THRESHOLD &&
      hsv.s <= this.SATURATION_THRESHOLD
    );
  }

  /**
   * Checks if RGB values indicate white
   */
  private static isWhite(rgb: RGB): boolean {
    return (
      rgb.r > this.WHITE_THRESHOLD &&
      rgb.g > this.WHITE_THRESHOLD &&
      rgb.b > this.WHITE_THRESHOLD
    );
  }

  /**
   * Checks if RGB values indicate black
   */
  private static isBlack(rgb: RGB): boolean {
    return (
      rgb.r < this.BLACK_THRESHOLD &&
      rgb.g < this.BLACK_THRESHOLD &&
      rgb.b < this.BLACK_THRESHOLD
    );
  }

  /**
   * Converts hexadecimal color to RGB
   * @param hex Hexadecimal color string
   * @returns RGB color object
   */
  private static hexToRgb(hex: string): RGB {
    const cleanHex = hex.charAt(0) === '#' ? hex.substring(1) : hex;

    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16),
    };
  }

  /**
   * Converts RGB color to HSV
   * @param rgb RGB color object
   * @returns HSV color object
   */
  private static rgbToHsv(rgb: RGB): HSV {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    let s = 0;
    const v = max;

    s = max === 0 ? 0 : diff / max;

    if (diff === 0) {
      h = 0;
    } else {
      switch (max) {
        case r:
          h = (g - b) / diff + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / diff + 2;
          break;
        case b:
          h = (r - g) / diff + 4;
          break;
      }
      h *= 60;
    }

    if (h < 0) h += 360;

    return { h, s, v };
  }

  /**
   * Determines base color name from HSV hue value
   * @param hsv HSV color object
   * @returns Base color name
   */
  private static getBaseColor(hsv: HSV): string {
    const hue = hsv.h;

    if (hue >= 350 || hue < 10) return 'red';
    if (hue >= 10 && hue < 45) return 'orange';
    if (hue >= 45 && hue < 70) return 'yellow';
    if (hue >= 70 && hue < 150) return 'green';
    if (hue >= 150 && hue < 200) return 'cyan';
    if (hue >= 200 && hue < 260) return 'blue';
    if (hue >= 260 && hue < 310) return 'purple';
    return 'magenta';
  }
}
