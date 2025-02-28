"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColorAnalyzer = void 0;
class ColorAnalyzer {
    static analyzeColor(hex) {
        const rgb = this.hexToRgb(hex);
        const hsv = this.rgbToHsv(rgb);
        if (this.isWhite(rgb))
            return 'white';
        if (this.isBlack(rgb))
            return 'black';
        if (this.isGray(rgb, hsv))
            return 'gray';
        const baseColor = this.getBaseColor(hsv);
        return baseColor;
    }
    static isGray(rgb, hsv) {
        const maxDiff = Math.max(Math.abs(rgb.r - rgb.g), Math.abs(rgb.g - rgb.b), Math.abs(rgb.b - rgb.r));
        return (maxDiff <= this.GRAY_DIFFERENCE_THRESHOLD &&
            hsv.s <= this.SATURATION_THRESHOLD);
    }
    static isWhite(rgb) {
        return (rgb.r > this.WHITE_THRESHOLD &&
            rgb.g > this.WHITE_THRESHOLD &&
            rgb.b > this.WHITE_THRESHOLD);
    }
    static isBlack(rgb) {
        return (rgb.r < this.BLACK_THRESHOLD &&
            rgb.g < this.BLACK_THRESHOLD &&
            rgb.b < this.BLACK_THRESHOLD);
    }
    static hexToRgb(hex) {
        const cleanHex = hex.charAt(0) === '#' ? hex.substring(1) : hex;
        return {
            r: parseInt(cleanHex.substring(0, 2), 16),
            g: parseInt(cleanHex.substring(2, 4), 16),
            b: parseInt(cleanHex.substring(4, 6), 16),
        };
    }
    static rgbToHsv(rgb) {
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
        }
        else {
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
        if (h < 0)
            h += 360;
        return { h, s, v };
    }
    static getBaseColor(hsv) {
        const hue = hsv.h;
        if (hue >= 350 || hue < 10)
            return 'red';
        if (hue >= 10 && hue < 45)
            return 'orange';
        if (hue >= 45 && hue < 70)
            return 'yellow';
        if (hue >= 70 && hue < 150)
            return 'green';
        if (hue >= 150 && hue < 200)
            return 'cyan';
        if (hue >= 200 && hue < 260)
            return 'blue';
        if (hue >= 260 && hue < 310)
            return 'purple';
        return 'magenta';
    }
}
exports.ColorAnalyzer = ColorAnalyzer;
ColorAnalyzer.LIGHT_THRESHOLD = 0.7;
ColorAnalyzer.DARK_THRESHOLD = 0.3;
ColorAnalyzer.WHITE_THRESHOLD = 245;
ColorAnalyzer.BLACK_THRESHOLD = 10;
ColorAnalyzer.GRAY_DIFFERENCE_THRESHOLD = 15;
ColorAnalyzer.SATURATION_THRESHOLD = 0.15;
//# sourceMappingURL=colors.js.map