"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtpeaceHelper = void 0;
class ArtpeaceHelper {
    static generateRandomPosition(width, height) {
        return {
            xPos: Math.floor(Math.random() * width),
            yPos: Math.floor(Math.random() * height),
        };
    }
    static async validateAndFillDefaults(param, checker) {
        const { width, height } = checker.getWorldSize();
        const randomPos = this.generateRandomPosition(width, height);
        const position = await checker.checkPosition(param.xPos ?? randomPos.xPos, param.yPos ?? randomPos.yPos);
        const color = await checker.checkColor(param.color ?? this.DEFAULT_COLOR);
        return {
            position,
            color,
        };
    }
}
exports.ArtpeaceHelper = ArtpeaceHelper;
ArtpeaceHelper.DEFAULT_COLOR = 'black';
//# sourceMappingURL=helper.js.map