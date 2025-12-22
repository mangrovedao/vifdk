import type { ContractFunctionParameters, Hex } from 'viem'

export const RouterExecuteABI = [
	{
		type: 'function',
		name: 'execute',
		inputs: [
			{ name: 'commands', type: 'bytes', internalType: 'bytes' },
			{ name: 'args', type: 'bytes[]', internalType: 'bytes[]' },
		],
		outputs: [
			{
				name: 'result',
				type: 'tuple[]',
				internalType: 'struct DispatchResult[]',
				components: [
					{ name: 'success', type: 'bool', internalType: 'bool' },
					{ name: 'returnData', type: 'bytes', internalType: 'bytes' },
				],
			},
		],
		stateMutability: 'payable',
	},
	{
		type: 'function',
		name: 'execute',
		inputs: [
			{ name: 'commands', type: 'bytes', internalType: 'bytes' },
			{ name: 'args', type: 'bytes[]', internalType: 'bytes[]' },
			{ name: 'deadline', type: 'uint256', internalType: 'uint256' },
		],
		outputs: [
			{
				name: 'result',
				type: 'tuple[]',
				internalType: 'struct DispatchResult[]',
				components: [
					{ name: 'success', type: 'bool', internalType: 'bool' },
					{ name: 'returnData', type: 'bytes', internalType: 'bytes' },
				],
			},
		],
		stateMutability: 'payable',
	},
] as const

export function execute(
	commands: Hex,
	args: Hex[],
	deadline?: bigint,
): Omit<
	ContractFunctionParameters<typeof RouterExecuteABI, 'payable', 'execute'>,
	'address'
> {
	return {
		abi: RouterExecuteABI,
		functionName: 'execute',
		args: deadline ? [commands, args, deadline] : [commands, args],
	}
}
