import { defineWorkspace } from 'bunup'

export default defineWorkspace([
	{
		name: 'vifdk',
		root: 'packages/core',
		config: {
			format: ['esm', 'cjs'],
			exports: {
				includePackageJson: true,
			},
			entry: ['src/**/index.ts'],
		},
	},
])
