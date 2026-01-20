import { test as baseTest } from 'vitest'
import { getTestConfig, type TestConfig, toVifTestConfig } from './config'
import type { VifTestConfig } from './config/vif'
import { mainClient } from './utils'

type TestClient = ReturnType<typeof mainClient>

export const test = baseTest.extend<{
	client: TestClient
	config: TestConfig
	vifConfig: VifTestConfig
}>({
	// biome-ignore lint/correctness/noEmptyPattern: vitest fixture requires object destructuring
	config: async ({}, use) => {
		const config = getTestConfig()
		await use(config)
	},
	vifConfig: async ({ config }, use) => {
		await use(toVifTestConfig(config))
	},
	client: async ({ task, config }, use) => {
		const client = mainClient(task.id, config.multicall)
		await use(client)
	},
})

export {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
} from 'vitest'
