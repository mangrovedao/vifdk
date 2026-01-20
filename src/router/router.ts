import type { Address, TypedDataDefinition, TypedDataDomain } from 'viem'
import {
	type Authorization,
	type AuthorizationMessageType,
	signatureDataForAuthorization,
	vifDomain,
} from '../lib/authorization'
import { VifRouterActionsBuilder } from './actions/builder'
import type { Action } from './export'

export class VifRouter {
	public readonly CORE_DOMAIN: TypedDataDomain

	constructor(
		public readonly router: Address,
		public readonly core: Address,
		public readonly chainId: number,
	) {
		this.CORE_DOMAIN = vifDomain(chainId, core)
	}

	createActions(): VifRouterActionsBuilder<Action[]> {
		return new VifRouterActionsBuilder(this)
	}

	createTypedActions(): VifRouterActionsBuilder {
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
	): TypedDataDefinition<AuthorizationMessageType, 'Authorization'> {
		return signatureDataForAuthorization(authorization, this.CORE_DOMAIN)
	}
}
