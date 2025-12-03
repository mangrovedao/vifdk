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
	{
		name: 'vif-react',
		root: 'packages/vif-react',
		config: {
			format: ['esm', 'cjs'],
			exports: {
				includePackageJson: true,
			},
			entry: ['src/**/index.ts'],
		},
	},
	{
		name: 'vif-ponder-react',
		root: 'packages/vif-ponder-react',
		config: {
			format: ['esm', 'cjs'],
			exports: {
				includePackageJson: true,
			},
			entry: ['src/**/index.ts'],
		},
	},
])
