import { expect } from 'bun:test'
import { createWalletClient, http, publicActions, testActions } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains'
import { ipc } from 'viem/node'
import { config } from './config/tokens'

export const MNEMONIC =
	'test test test test test test test test test test test junk'

export const IPC = '/tmp/anvil.ipc'
export const PORT = 8545

export const BASE_IPC = '/tmp/base.ipc'
export const BASE_PORT = 8546

export function mainClient() {
	anvil.contracts = {
		multicall3: {
			address: config.multicall,
		},
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

export function expectCloseTo(a: bigint, b: bigint, percentage = 0.01) {
	const diff = Math.abs((Number(a - b) * 100) / Number(a))
	return expect(
		diff,
		`Expected ${a} to be close to ${b} within ${percentage}%`,
	).toBeLessThanOrEqual(percentage)
}
