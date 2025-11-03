import { defineConfig } from 'bunup'

export default defineConfig({
	format: ['esm', 'cjs'],
	exports: {
		includePackageJson: true,
	},
	entry: ['src/**/index.ts'],
})
