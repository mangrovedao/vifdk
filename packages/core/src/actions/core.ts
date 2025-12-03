import type { Address, Client, ReadContractParameters } from 'viem'
import { readContract } from 'viem/actions'
import { getAction } from 'viem/utils'
import { nonce as nonceBuilder } from '../builder/core/auth'

export type CoreActions = {
	nonce(
		user: Address,
		params?: Omit<
			ReadContractParameters,
			'address' | 'abi' | 'functionName' | 'args'
		>,
	): Promise<bigint>
}

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
