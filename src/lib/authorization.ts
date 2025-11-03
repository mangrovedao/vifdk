import type { Address } from 'viem'

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
