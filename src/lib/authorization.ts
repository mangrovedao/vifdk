import type { Address, TypedDataDefinition, TypedDataDomain } from 'viem'

/** Represents an authorization */
export type Authorization = {
	/** The authorizer of the authorization */
	authorizer: Address
	/** The authorized address */
	authorized: Address
	/** Whether the authorization is authorized */
	isAuthorized: boolean
	/** The nonce of the authorization */
	nonce: bigint
	/** The deadline of the authorization */
	deadline: Date
}

/** The message type for the authorization */
export type AuthorizationMessageType = {
	Authorization: [
		{ name: 'authorizer'; type: 'address' },
		{ name: 'authorized'; type: 'address' },
		{ name: 'isAuthorized'; type: 'bool' },
		{ name: 'nonce'; type: 'uint256' },
		{ name: 'deadline'; type: 'uint256' },
	]
}

/** The types for the authorization */
export const AUTHORIZATION_TYPES: AuthorizationMessageType = {
	Authorization: [
		{ name: 'authorizer', type: 'address' },
		{ name: 'authorized', type: 'address' },
		{ name: 'isAuthorized', type: 'bool' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

/**
 * Creates the EIP-712 domain for the VIF authorization
 * @param chainId - The chain ID
 * @param address - The address of the VIF contract
 * @returns The EIP-712 domain for Vif
 */
export function vifDomain(chainId: number, address: Address): TypedDataDomain {
	return {
		name: 'Vif',
		version: '1.0.0',
		chainId,
		verifyingContract: address,
	}
}

/**
 * Creates the signature data for the authorization
 * @param authorization - The authorization
 * @param domain - The EIP-712 domain for Vif
 * @returns The signature data for the authorization
 */
export function signatureDataForAuthorization(
	authorization: Authorization,
	domain: TypedDataDomain,
): TypedDataDefinition<AuthorizationMessageType, 'Authorization'> {
	return {
		domain,
		types: AUTHORIZATION_TYPES,
		primaryType: 'Authorization',
		message: {
			...authorization,
			deadline: BigInt(Math.floor(authorization.deadline.getTime() / 1000)),
		},
	}
}
