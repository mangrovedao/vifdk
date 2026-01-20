import { anvil, type Instance } from 'prool/instances'
import { beforeEach } from 'vitest'
import { BASE_IPC, baseClient, IPC, MNEMONIC, PORT } from './utils'

let proolInstance: Instance | undefined

beforeEach(async () => {
	// Get current block from base instance
	const client = baseClient()
	const initBlock = await client.getBlockNumber()

	// Stop existing prool instance if running
	if (proolInstance) {
		await proolInstance.stop()
	}

	// Create new forked instance
	proolInstance = anvil({
		mnemonic: MNEMONIC,
		port: PORT,
		ipc: IPC,
		forkUrl: BASE_IPC,
		forkBlockNumber: initBlock,
	})
	await proolInstance.start()
})
