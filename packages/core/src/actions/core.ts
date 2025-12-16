import type { Address, Client, ReadContractParameters } from 'viem'
import { readContract } from 'viem/actions'
import { getAction } from 'viem/utils'
import { nonce as nonceBuilder } from '../builder/core/auth'

/**
 * Actions for interacting with the VifCore contract
 */
export type CoreActions = {
	/**
	 * Retrieves the nonce for a given user address
	 * @param user - The user's address to query the nonce for
	 * @param params - Additional contract read parameters (optional)
	 * @returns The current nonce value as a bigint
	 */
	nonce(
		user: Address,
		params?: Omit<
			ReadContractParameters,
			'address' | 'abi' | 'functionName' | 'args'
		>,
	): Promise<bigint>
}

/**
 * Creates actions for interacting with the VifCore contract
 * @param vifCore - Address of the VifCore contract
 * @returns Actions for interacting with the core contract
 * @example
 * const client = createClient(...)
 *   .extend(coreActions("0x123..."))
 *
 * const userNonce = await client.nonce("0xUserAddress...")
 */
export function coreActions(vifCore: Address) {
	return (client: Client): CoreActions => {
		return {
			nonce(user, params) {
				return getAction(
					client,
					readContract,
					'readContract',
				)({
					address: vifCore,
					...nonceBuilder(user),
					...params,
				})
			},
		}
	}
}
