import type { ContractFunctionParameters, Hex } from 'viem'
import type { SemiMarket } from '../../lib/market'

/** ABI for the packedOfferList function that retrieves offer list data from the VifReader contract */
export const OFFER_LIST_ABI = [
	{
		type: 'function',
		name: 'packedOfferList',
		inputs: [
			{ name: 'marketId', type: 'bytes32', internalType: 'bytes32' },
			{ name: 'fromId', type: 'uint40', internalType: 'uint40' },
			{ name: 'maxOffers', type: 'uint256', internalType: 'uint256' },
		],
		outputs: [
			{ name: 'nextOfferId', type: 'uint40', internalType: 'uint40' },
			{ name: 'offerIds', type: 'uint40[]', internalType: 'uint40[]' },
			{ name: 'offers', type: 'uint256[]', internalType: 'uint256[]' },
			{ name: 'owners', type: 'address[]', internalType: 'address[]' },
		],
		stateMutability: 'view',
	},
] as const

/**
 *
 * @param marketId - The market id
 * @param fromId - The starting offer id (0 will automatically start from the first offer)
 * @param maxOffers - The maximum number of offers to return (@default: 100)
 * @returns Contract function parameters for the packedOfferList call
 * @dev This call returns the next offer id, and 3 lists of same length:
 * - offerIds: the offer ids
 * - offers: the packed offers data
 * - owners: the owners of the offers
 */
export function packedOfferList(
	marketId: SemiMarket | Hex,
	fromId: number = 0,
	maxOffers: number = 100,
): Omit<
	ContractFunctionParameters<typeof OFFER_LIST_ABI, 'view', 'packedOfferList'>,
	'address'
> {
	const key = typeof marketId === 'string' ? marketId : marketId.key
	return {
		abi: OFFER_LIST_ABI,
		functionName: 'packedOfferList',
		args: [key, fromId, BigInt(maxOffers)],
	}
}
