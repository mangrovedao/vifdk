import type { ContractFunctionParameters, Hex } from 'viem'

export const CoreReadABI = [
	{
		type: 'function',
		name: 'extsload',
		inputs: [{ name: 'slot', type: 'bytes32', internalType: 'bytes32' }],
		outputs: [{ name: 'value', type: 'uint256', internalType: 'uint256' }],
		stateMutability: 'view',
	},
] as const

export type SlotLoaderParameters = Omit<
	ContractFunctionParameters<typeof CoreReadABI, 'view', 'extsload'>,
	'address'
>

export function extsload(slot: Hex): SlotLoaderParameters {
	return {
		abi: CoreReadABI,
		functionName: 'extsload',
		args: [slot],
	}
}
