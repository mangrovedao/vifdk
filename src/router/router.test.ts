import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { VifRouter } from './router'

const VIF_ADDRESS: Address = '0x1234567890123456789012345678901234567890'
const ROUTER_ADDRESS: Address = '0xabcdef0123456789abcdef0123456789abcdef01'
const USER_ADDRESS: Address = '0xfedcba9876543210fedcba9876543210fedcba98'

describe('VifRouter', () => {
	it('creates instance with correct properties', () => {
		const router = new VifRouter(ROUTER_ADDRESS, VIF_ADDRESS, 1)

		expect(router.router).toBe(ROUTER_ADDRESS)
		expect(router.core).toBe(VIF_ADDRESS)
		expect(router.chainId).toBe(1)
	})

	it('creates correct CORE_DOMAIN', () => {
		const router = new VifRouter(ROUTER_ADDRESS, VIF_ADDRESS, 137)

		expect(router.CORE_DOMAIN.name).toBe('Vif')
		expect(router.CORE_DOMAIN.version).toBe('1.0.0')
		expect(router.CORE_DOMAIN.chainId).toBe(137)
		expect(router.CORE_DOMAIN.verifyingContract).toBe(VIF_ADDRESS)
	})

	describe('createActions', () => {
		it('returns a VifRouterActionsBuilder', () => {
			const router = new VifRouter(ROUTER_ADDRESS, VIF_ADDRESS, 1)
			const builder = router.createActions()

			expect(builder).toBeDefined()
			expect(typeof builder.orderSingle).toBe('function')
			expect(typeof builder.limitSingle).toBe('function')
			expect(typeof builder.build).toBe('function')
		})
	})

	describe('createTypedActions', () => {
		it('returns a VifRouterActionsBuilder', () => {
			const router = new VifRouter(ROUTER_ADDRESS, VIF_ADDRESS, 1)
			const builder = router.createTypedActions()

			expect(builder).toBeDefined()
			expect(typeof builder.orderSingle).toBe('function')
			expect(typeof builder.limitSingle).toBe('function')
		})
	})

	describe('authorizationData', () => {
		it('creates authorization data with correct fields', () => {
			const router = new VifRouter(ROUTER_ADDRESS, VIF_ADDRESS, 1)
			const deadline = new Date('2025-06-01T00:00:00Z')

			const authData = router.authorizationData(USER_ADDRESS, 5n, deadline)

			expect(authData.authorizer).toBe(USER_ADDRESS)
			expect(authData.authorized).toBe(ROUTER_ADDRESS)
			expect(authData.isAuthorized).toBe(true)
			expect(authData.nonce).toBe(5n)
			expect(authData.deadline).toBe(deadline)
		})

		it('uses router address as authorized', () => {
			const router = new VifRouter(ROUTER_ADDRESS, VIF_ADDRESS, 42161)
			const deadline = new Date()

			const authData = router.authorizationData(USER_ADDRESS, 0n, deadline)

			expect(authData.authorized).toBe(ROUTER_ADDRESS)
		})
	})

	describe('singatureDataForAuthorization', () => {
		it('creates signature data with correct structure', () => {
			const router = new VifRouter(ROUTER_ADDRESS, VIF_ADDRESS, 1)
			const deadline = new Date('2025-01-15T12:00:00Z')
			const authorization = router.authorizationData(
				USER_ADDRESS,
				10n,
				deadline,
			)

			const signatureData = router.singatureDataForAuthorization(authorization)

			expect(signatureData.domain).toBe(router.CORE_DOMAIN)
			expect(signatureData.primaryType).toBe('Authorization')
			expect(signatureData.message.authorizer).toBe(USER_ADDRESS)
			expect(signatureData.message.authorized).toBe(ROUTER_ADDRESS)
			expect(signatureData.message.nonce).toBe(10n)
		})

		it('converts deadline to unix timestamp', () => {
			const router = new VifRouter(ROUTER_ADDRESS, VIF_ADDRESS, 1)
			const deadline = new Date('2025-01-01T00:00:00Z')
			const authorization = router.authorizationData(USER_ADDRESS, 0n, deadline)

			const signatureData = router.singatureDataForAuthorization(authorization)

			expect(signatureData.message.deadline).toBe(
				BigInt(Math.floor(deadline.getTime() / 1000)),
			)
		})
	})
})

describe('VifRouter with different chain IDs', () => {
	const chainIds = [1, 10, 137, 42161, 8453]

	it.each(chainIds)('works correctly with chain ID %i', (chainId) => {
		const router = new VifRouter(ROUTER_ADDRESS, VIF_ADDRESS, chainId)

		expect(router.chainId).toBe(chainId)
		expect(router.CORE_DOMAIN.chainId).toBe(chainId)
	})
})
