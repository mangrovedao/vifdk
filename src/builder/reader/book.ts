import type { ContractFunctionParameters, Hex } from 'viem'
import type { SemiMarket } from '../../lib/market'
import type { Tick } from '../../lib/tick'

/** ABI for the packedBook function that retrieves book data from the VifReader contract */
export const BOOK_ABI = [
	{
		type: 'function',
		name: 'packedBook',
		inputs: [
			{ name: 'marketId', type: 'bytes32', internalType: 'bytes32' },
			{ name: 'fromPricePoint', type: 'uint24', internalType: 'uint24' },
			{ name: 'maxPricePoints', type: 'uint24', internalType: 'uint24' },
		],
		outputs: [
			{ name: 'nextPricePoint', type: 'uint24', internalType: 'uint24' },
			{
				name: 'offerListsPacked',
				type: 'uint256[]',
				internalType: 'uint256[]',
			},
		],
		stateMutability: 'view',
	},
] as const

/**
 *
 * @param marketId - The market id
 * @param fromPricePoint - The starting price point (0 will automatically start from the first price point)
 * @param maxPricePoints - The maximum number of price points to return (@default: 100)
 * @returns Contract function parameters for the packedBook call
 * @dev This call returns the next price point, and a list of packed offer lists
 * @dev An offer list contains:
 * - tail and head offer ids
 * - number of offers
 * - total promised amount
 * - The index of the queried offer list (redundant when queried standalone)
 */
export function packedBook(
	marketId: SemiMarket | Hex,
	fromPricePoint: Tick | number = 0,
	maxPricePoints: number = 100,
): Omit<
	ContractFunctionParameters<typeof BOOK_ABI, 'view', 'packedBook'>,
	'address'
> {
	const key = typeof marketId === 'string' ? marketId : marketId.key
	const fromPricePointValue =
		typeof fromPricePoint === 'number' ? fromPricePoint : fromPricePoint.index()
	return {
		abi: BOOK_ABI,
		functionName: 'packedBook',
		args: [key, fromPricePointValue, maxPricePoints],
	}
}
