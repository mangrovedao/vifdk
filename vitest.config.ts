import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
		globalSetup: ['./test/globalSetup.ts'],
		setupFiles: ['./test/setup.ts'],
		testTimeout: 60_000,
		hookTimeout: 60_000,
		fileParallelism: false,
		sequence: {
			concurrent: false,
		},
	},
	resolve: {
		alias: {
			'~test': resolve(__dirname, './test'),
		},
	},
})
