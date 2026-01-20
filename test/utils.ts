import type { Address } from 'viem'
import { createWalletClient, http, publicActions, testActions } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains'

export const MNEMONIC =
	'test test test test test test test test test test test junk'

export const IPC = '/tmp/anvil.ipc'
export const PORT = 8545

export const BASE_IPC = '/tmp/base.ipc'
export const BASE_PORT = 8546

/**
 * Generate a unique pool ID from a test ID using a simple hash.
 * This ensures each test gets a unique anvil fork regardless of
 * worker process boundaries or execution order.
 */
function getPoolIdForTest(testId: string): number {
	let hash = 0
	for (let i = 0; i < testId.length; i++) {
		const char = testId.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // Convert to 32-bit integer
	}
	// Ensure positive number and add some entropy from env
	const base = Math.abs(hash)
	const poolId = Number(process.env.VITEST_POOL_ID ?? 1)
	return base + poolId * 1000000
}

export function mainClient(testId: string, multicallAddress?: Address) {
	const poolId = getPoolIdForTest(testId)
	const chain = multicallAddress
		? {
				...anvil,
				contracts: {
					...anvil.contracts,
					multicall3: { address: multicallAddress },
				},
			}
		: anvil
	const client = createWalletClient({
		account: mnemonicToAccount(MNEMONIC),
		transport: http(`http://localhost:${PORT}/${poolId}`),
		chain,
		pollingInterval: 1,
	})
		.extend(publicActions)
		.extend(testActions({ mode: 'anvil' }))
	return client
}

export function baseClient() {
	const client = createWalletClient({
		account: mnemonicToAccount(MNEMONIC),
		transport: http(`http://localhost:${BASE_PORT}`),
		chain: anvil,
		pollingInterval: 1,
	})
		.extend(publicActions)
		.extend(testActions({ mode: 'anvil' }))
	return client
}
