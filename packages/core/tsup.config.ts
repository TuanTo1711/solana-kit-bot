import { defineConfig } from 'tsup'
import pkg from './package.json'

export default defineConfig({
  entry: ['src/**/*.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  banner: {
    js: `
/**
 * @project Solana Kit Bot
 * @version ${pkg.version}
 */
    `,
  },
})
