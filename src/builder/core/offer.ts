import { encodeAbiParameters, type Hex, keccak256 } from 'viem'
import type { SemiMarket } from '../../lib/market'
import type { SlotLoaderParameters } from './extloader'
import { extsload } from './extloader'

const OFFER_SEED = 0x68d83aa7n

export function rawOffer(
	market: SemiMarket | Hex,
	offerId: number,
): SlotLoaderParameters {
	const key = typeof market === 'string' ? market : market.key
	const _offerWord = OFFER_SEED + (BigInt(offerId) << 216n)
	const slot = keccak256(
		encodeAbiParameters(
			[{ type: 'bytes32' }, { type: 'uint256' }],
			[key, _offerWord],
		),
	)
	return extsload(slot)
}

const OFFER_OWNER_SEED = 0xb9c53f1en

export function offerOwner(
	market: SemiMarket | Hex,
	offerId: number,
): SlotLoaderParameters {
	const key = typeof market === 'string' ? market : market.key
	const _offerWord = OFFER_OWNER_SEED + (BigInt(offerId) << 216n)
	const slot = keccak256(
		encodeAbiParameters(
			[{ type: 'bytes32' }, { type: 'uint256' }],
			[key, _offerWord],
		),
	)
	return extsload(slot)
}
