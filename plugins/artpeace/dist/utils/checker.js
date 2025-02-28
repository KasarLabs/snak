"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Checker = void 0;
const colors_1 = require("./colors");
class Checker {
    constructor(param) {
        this.param = param;
    }
    async checkWorld() {
        try {
            let id;
            if (typeof this.param === 'string') {
                const response = await fetch(`https://api.art-peace.net/get-world-id?worldName=${this.param}`);
                if (!response.ok)
                    throw new Error(`HTTP Error status: ${response.status}`);
                const data = await response.json();
                id = data.data;
            }
            else
                id = this.param;
            const response = await fetch(`https://api.art-peace.net/get-world?worldId=${id}`);
            if (!response.ok)
                throw new Error(`HTTP Error status: ${response.status}`);
            const data = await response.json();
            this.world = data.data;
            return this.world.worldId;
        }
        catch (error) {
            throw new Error(error.message
                ? error.message
                : 'Error when check the world ID for artpeace');
        }
    }
    async checkPosition(x, y) {
        try {
            if (x > this.world.width) {
                throw new Error('Bad Position');
            }
            else if (y > this.world.height) {
                throw new Error('Bad Position.');
            }
            return x + y * this.world.width;
        }
        catch (error) {
            throw new Error(error.message
                ? error.message
                : 'Error when check the position for artpeace');
        }
    }
    async getColors() {
        try {
            const response = await fetch(`https://api.art-peace.net/get-worlds-colors?worldId=${this.world.worldId}`);
            if (!response.ok) {
                throw new Error(`Error during get world colors fetch: HTTP Error status: ${response.status}`);
            }
            const data = await response.json();
            const allHexColor = data.data;
            this.hexColors = allHexColor;
            const allColor = allHexColor.map((cleanColor) => colors_1.ColorAnalyzer.analyzeColor(cleanColor));
            this.colors = allColor;
        }
        catch (error) {
            throw new Error(error.message);
        }
    }
    async checkColor(color) {
        try {
            const cleanColor = color.charAt(0) === '#' ? color.substring(1) : color;
            const isHex = this.hexColors.indexOf(cleanColor);
            if (isHex != -1)
                return `${isHex}`;
            const numColor = parseInt(color);
            if (numColor < 255 && numColor <= this.hexColors.length)
                return color;
            const index = this.colors.indexOf(cleanColor);
            if (index === -1)
                throw new Error(`the color ${cleanColor} is not available in this world `);
            return `${index}`;
        }
        catch (error) {
            throw new Error(error.message
                ? error.message
                : 'Error when check the colors for artpeace');
        }
    }
    getWorldSize() {
        return {
            width: this.world.width,
            height: this.world.height,
        };
    }
}
exports.Checker = Checker;
//# sourceMappingURL=checker.js.map