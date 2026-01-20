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

// Map test IDs to pool IDs for consistent pool assignment within a test
const testPoolIds = new Map<string, number>()
let poolIdCounter = 0

function getPoolIdForTest(testId: string): number {
	let poolId = testPoolIds.get(testId)
	if (poolId === undefined) {
		const base =
			Number(process.env.VITEST_POOL_ID ?? 1) *
			Number(process.env.VITEST_SHARD_ID ?? 1) *
			100000
		poolId = base + poolIdCounter++
		testPoolIds.set(testId, poolId)
	}
	return poolId
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
