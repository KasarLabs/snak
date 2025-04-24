import { defineConfig } from 'tsup';
import path from 'path';

export default defineConfig({
  format: ['esm', 'cjs'],
  entry: [path.resolve(__dirname, './src/index.ts')],
  outDir: './dist',
  dts: true,
  skipNodeModulesBundle: true,
  clean: true,
});
