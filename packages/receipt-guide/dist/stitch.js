"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.stitchReceipts = stitchReceipts;
const expo_image_manipulator_1 = require("expo-image-manipulator");
const stitchLayout_1 = require("./stitchLayout");
async function stitchReceipts(assets) {
    const contexts = assets.map((a) => expo_image_manipulator_1.ImageManipulator.manipulate(a.uri));
    try {
        const sizes = [];
        for (const context of contexts) {
            const rendered = await context.renderAsync();
            sizes.push({ width: rendered.width, height: rendered.height });
            rendered.release();
        }
        const layout = (0, stitchLayout_1.stitchLayout)(sizes);
        const { ImageFormat, Skia } = await Promise.resolve().then(() => __importStar(require('@shopify/react-native-skia')));
        const surface = Skia.Surface.MakeOffscreen(layout.width, layout.height);
        if (!surface)
            throw new Error('stitch_surface');
        try {
            const canvas = surface.getCanvas();
            canvas.clear(Skia.Color('white'));
            const paint = Skia.Paint();
            for (let i = 0; i < contexts.length; i += 1) {
                const rect = layout.rects[i];
                contexts[i].resize({ width: rect.width, height: rect.height });
                const rendered = await contexts[i].renderAsync();
                let base64;
                try {
                    base64 = (await rendered.saveAsync({ format: expo_image_manipulator_1.SaveFormat.JPEG, compress: 0.95, base64: true })).base64;
                }
                finally {
                    rendered.release();
                }
                if (!base64)
                    throw new Error('stitch_read');
                const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64));
                if (!image)
                    throw new Error('stitch_decode');
                canvas.drawImageRect(image, Skia.XYWHRect(0, 0, image.width(), image.height()), Skia.XYWHRect(rect.x, rect.y, rect.width, rect.height), paint);
                image.dispose();
            }
            surface.flush();
            const snapshot = surface.makeImageSnapshot();
            const jpeg = snapshot.encodeToBase64(ImageFormat.JPEG, 90);
            snapshot.dispose();
            if (!jpeg)
                throw new Error('stitch_encode');
            const { File, Paths } = await Promise.resolve().then(() => __importStar(require('expo-file-system')));
            const file = new File(Paths.cache, `receipt-stitch-${Date.now()}.jpg`);
            file.create({ overwrite: true });
            file.write(jpeg, { encoding: 'base64' });
            return { uri: file.uri, width: layout.width, height: layout.height, type: 'image', mimeType: 'image/jpeg', fileName: 'receipt.jpg' };
        }
        finally {
            surface.dispose();
        }
    }
    finally {
        for (const context of contexts)
            context.release();
    }
}
