/**
 * ABI for the openMarkets function that retrieves market data from the VifReader contract
 */
import {
	type Address,
	type ContractFunctionParameters,
	erc20Abi,
	erc20Abi_bytes32,
} from 'viem'

const baseABI = {
	type: 'function',
	name: 'openMarkets',
	inputs: [
		{ name: 'from', type: 'uint256', internalType: 'uint256' },
		{ name: 'maxLength', type: 'uint256', internalType: 'uint256' },
	],
	outputs: [
		{
			name: 'results',
			type: 'tuple[]',
			internalType: 'struct VifReader.OpenMarketsResult[]',
			components: [
				{
					name: 'market01',
					type: 'tuple',
					internalType: 'struct Market',
					components: [
						{
							name: 'outboundToken',
							type: 'address',
							internalType: 'address',
						},
						{ name: 'outboundUnits', type: 'uint64', internalType: 'uint64' },
						{
							name: 'minOutboundUnits',
							type: 'uint32',
							internalType: 'uint32',
						},
						{ name: 'active', type: 'bool', internalType: 'bool' },
						{
							name: 'inboundToken',
							type: 'address',
							internalType: 'address',
						},
						{ name: 'inboundUnits', type: 'uint64', internalType: 'uint64' },
						{ name: 'tickSpacing', type: 'uint16', internalType: 'uint16' },
						{ name: 'fees', type: 'uint16', internalType: 'uint16' },
					],
				},
				{
					name: 'market10',
					type: 'tuple',
					internalType: 'struct Market',
					components: [
						{
							name: 'outboundToken',
							type: 'address',
							internalType: 'address',
						},
						{ name: 'outboundUnits', type: 'uint64', internalType: 'uint64' },
						{
							name: 'minOutboundUnits',
							type: 'uint32',
							internalType: 'uint32',
						},
						{ name: 'active', type: 'bool', internalType: 'bool' },
						{
							name: 'inboundToken',
							type: 'address',
							internalType: 'address',
						},
						{ name: 'inboundUnits', type: 'uint64', internalType: 'uint64' },
						{ name: 'tickSpacing', type: 'uint16', internalType: 'uint16' },
						{ name: 'fees', type: 'uint16', internalType: 'uint16' },
					],
				},
			],
		},
	],
	stateMutability: 'view',
} as const

/** ABI for the openMarkets function on VifReader contract */
export const openMarketsABI: [
	typeof baseABI,
	Omit<typeof baseABI, 'inputs'> & { inputs: readonly [] },
] = [
	baseABI,
	{
		...baseABI,
		inputs: [],
	},
] as const

/**
 * Creates parameters for calling the openMarkets function
 * @param from - Starting index for pagination (default: 0)
 * @param maxLength - Maximum number of markets to return (default: 100)
 * @returns Contract function parameters for the openMarkets call
 */
export function openMarkets(
	from?: number,
	maxLength = 100,
): Omit<
	ContractFunctionParameters<typeof openMarketsABI, 'view', 'openMarkets'>,
	'address'
> {
	return {
		abi: openMarketsABI,
		functionName: 'openMarkets',
		args: from ? [BigInt(from), BigInt(maxLength)] : [],
	}
}
/**
 * Creates parameters for fetching basic token metadata (decimals and symbol)
 * @param token - Token contract address
 * @returns Array of contract function parameters for decimals and symbol calls
 */
export function tokenMetadata(token: Address): [
	ContractFunctionParameters<typeof erc20Abi, 'view', 'decimals'> & {
		address: Address
	},
	ContractFunctionParameters<typeof erc20Abi, 'view', 'symbol'> & {
		address: Address
	},
] {
	return [
		{ address: token, abi: erc20Abi, functionName: 'decimals' },
		{ address: token, abi: erc20Abi, functionName: 'symbol' },
	]
}

/**
 * Creates parameters for fetching token metadata with fallback for non-standard ERC20 tokens
 * Includes an additional call to handle tokens that return bytes32 for symbol
 * @param token - Token contract address
 * @returns Array of contract function parameters for decimals, symbol and fallback symbol calls
 */
export function tokenMetadataWithFallback(token: Address): [
	ContractFunctionParameters<typeof erc20Abi, 'view', 'decimals'> & {
		address: Address
	},
	ContractFunctionParameters<typeof erc20Abi, 'view', 'symbol'> & {
		address: Address
	},
	ContractFunctionParameters<typeof erc20Abi_bytes32, 'view', 'symbol'> & {
		address: Address
	},
] {
	return [
		...tokenMetadata(token),
		{ address: token, abi: erc20Abi_bytes32, functionName: 'symbol' },
	]
}
