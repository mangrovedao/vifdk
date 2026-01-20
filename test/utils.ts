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

export function mainClient(multicallAddress?: Address) {
	if (multicallAddress) {
		anvil.contracts = {
			multicall3: {
				address: multicallAddress,
			},
		}
	}
	const client = createWalletClient({
		account: mnemonicToAccount(MNEMONIC),
		transport: http(`http://localhost:${PORT}`),
		chain: anvil,
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
