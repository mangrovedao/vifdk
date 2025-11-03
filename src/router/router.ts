import type {
	Address,
	TypedData,
	TypedDataDefinition,
	TypedDataDomain,
} from 'viem'
import type { Authorization } from '../lib/authorization'
import { VifRouterActionsBuilder } from './actions/builder'

export class VifRouter {
	private readonly _coreDomain: TypedDataDomain
	private static readonly types = {
		Authorization: [
			{ name: 'authorizer', type: 'address' },
			{ name: 'authorized', type: 'address' },
			{ name: 'isAuthorized', type: 'bool' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' },
		],
	} as const satisfies TypedData

	constructor(
		public readonly router: Address,
		public readonly core: Address,
		public readonly chainId: number,
	) {
		this._coreDomain = {
			name: 'Vif',
			version: '1.0.0',
			chainId: chainId,
			verifyingContract: core,
		}
	}

	createActions(): VifRouterActionsBuilder {
		return new VifRouterActionsBuilder(this)
	}

	authorizationData(
		user: Address,
		nonce: bigint,
		deadline: Date,
	): Authorization {
		return {
			authorizer: user,
			authorized: this.router,
			isAuthorized: true,
			nonce: nonce,
			deadline,
		}
	}

	singatureDataForAuthorization(
		authorization: Authorization,
	): TypedDataDefinition<typeof VifRouter.types, 'Authorization'> {
		return {
			domain: this._coreDomain,
			types: VifRouter.types,
			primaryType: 'Authorization',
			message: {
				...authorization,
				deadline: BigInt(Math.floor(authorization.deadline.getTime() / 1000)),
			},
		}
	}
}
