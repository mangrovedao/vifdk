import { type Address, encodeAbiParameters, keccak256 } from 'viem'
import type { SlotLoaderParameters } from './extloader'
import { extsload } from './extloader'

const AUTHORIZATION_NONCE_SEED = 0x94169588n

/**
 * Creates a slot loader parameter for the nonce of a user regarding the authorization
 * @param user - The user address
 * @returns The slot loader parameter
 */
export function nonce(user: Address): SlotLoaderParameters {
	const slot = keccak256(
		encodeAbiParameters(
			[{ type: 'address' }, { type: 'uint256' }],
			[user, AUTHORIZATION_NONCE_SEED],
		),
	)
	return extsload(slot)
}

const AUTHORIZATION_SEED = 0x078c51b7n

/**
 * Creates a slot loader parameter to read the authorization status
 * @param authorizer - The authorizer address
 * @param authorized - The authorized address
 * @returns The slot loader parameter
 */
export function authorized(
	authorizer: Address,
	authorized: Address,
): SlotLoaderParameters {
	const word2 = AUTHORIZATION_SEED + (BigInt(authorized) << 0x20n)
	const slot = keccak256(
		encodeAbiParameters(
			[{ type: 'address' }, { type: 'uint256' }],
			[authorizer, word2],
		),
	)
	return extsload(slot)
}
