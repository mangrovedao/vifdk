import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import {
	AUTHORIZATION_TYPES,
	type Authorization,
	signatureDataForAuthorization,
	vifDomain,
} from './authorization'

const VIF_ADDRESS: Address = '0x1234567890123456789012345678901234567890'
const USER_ADDRESS: Address = '0xabcdef0123456789abcdef0123456789abcdef01'
const ROUTER_ADDRESS: Address = '0xfedcba9876543210fedcba9876543210fedcba98'

describe('AUTHORIZATION_TYPES', () => {
	it('has the correct structure', () => {
		expect(AUTHORIZATION_TYPES.Authorization).toBeDefined()
		expect(AUTHORIZATION_TYPES.Authorization).toHaveLength(5)
	})

	it('contains all required fields', () => {
		const fields = AUTHORIZATION_TYPES.Authorization.map((f) => f.name)
		expect(fields).toContain('authorizer')
		expect(fields).toContain('authorized')
		expect(fields).toContain('isAuthorized')
		expect(fields).toContain('nonce')
		expect(fields).toContain('deadline')
	})

	it('has correct types for each field', () => {
		const authTypes = AUTHORIZATION_TYPES.Authorization
		expect(authTypes.find((f) => f.name === 'authorizer')?.type).toBe('address')
		expect(authTypes.find((f) => f.name === 'authorized')?.type).toBe('address')
		expect(authTypes.find((f) => f.name === 'isAuthorized')?.type).toBe('bool')
		expect(authTypes.find((f) => f.name === 'nonce')?.type).toBe('uint256')
		expect(authTypes.find((f) => f.name === 'deadline')?.type).toBe('uint256')
	})
})

describe('vifDomain', () => {
	it('creates a domain with correct name and version', () => {
		const domain = vifDomain(1, VIF_ADDRESS)

		expect(domain.name).toBe('Vif')
		expect(domain.version).toBe('1.0.0')
	})

	it('sets the correct chain ID', () => {
		const domain1 = vifDomain(1, VIF_ADDRESS)
		const domain137 = vifDomain(137, VIF_ADDRESS)
		const domain42161 = vifDomain(42161, VIF_ADDRESS)

		expect(domain1.chainId).toBe(1)
		expect(domain137.chainId).toBe(137)
		expect(domain42161.chainId).toBe(42161)
	})

	it('sets the correct verifying contract', () => {
		const domain = vifDomain(1, VIF_ADDRESS)

		expect(domain.verifyingContract).toBe(VIF_ADDRESS)
	})
})

describe('signatureDataForAuthorization', () => {
	it('creates valid typed data for signing', () => {
		const deadline = new Date('2025-01-01T00:00:00Z')
		const authorization: Authorization = {
			authorizer: USER_ADDRESS,
			authorized: ROUTER_ADDRESS,
			isAuthorized: true,
			nonce: 0n,
			deadline,
		}
		const domain = vifDomain(1, VIF_ADDRESS)

		const signatureData = signatureDataForAuthorization(authorization, domain)

		expect(signatureData.domain).toBe(domain)
		expect(signatureData.types).toBe(AUTHORIZATION_TYPES)
		expect(signatureData.primaryType).toBe('Authorization')
	})

	it('converts deadline Date to unix timestamp', () => {
		const deadline = new Date('2025-01-01T00:00:00Z')
		const authorization: Authorization = {
			authorizer: USER_ADDRESS,
			authorized: ROUTER_ADDRESS,
			isAuthorized: true,
			nonce: 0n,
			deadline,
		}
		const domain = vifDomain(1, VIF_ADDRESS)

		const signatureData = signatureDataForAuthorization(authorization, domain)

		expect(signatureData.message.deadline).toBe(
			BigInt(Math.floor(deadline.getTime() / 1000)),
		)
	})

	it('preserves all authorization fields in message', () => {
		const deadline = new Date('2025-06-15T12:30:00Z')
		const authorization: Authorization = {
			authorizer: USER_ADDRESS,
			authorized: ROUTER_ADDRESS,
			isAuthorized: true,
			nonce: 42n,
			deadline,
		}
		const domain = vifDomain(137, VIF_ADDRESS)

		const signatureData = signatureDataForAuthorization(authorization, domain)

		expect(signatureData.message.authorizer).toBe(USER_ADDRESS)
		expect(signatureData.message.authorized).toBe(ROUTER_ADDRESS)
		expect(signatureData.message.isAuthorized).toBe(true)
		expect(signatureData.message.nonce).toBe(42n)
	})

	it('handles isAuthorized = false', () => {
		const deadline = new Date()
		const authorization: Authorization = {
			authorizer: USER_ADDRESS,
			authorized: ROUTER_ADDRESS,
			isAuthorized: false,
			nonce: 1n,
			deadline,
		}
		const domain = vifDomain(1, VIF_ADDRESS)

		const signatureData = signatureDataForAuthorization(authorization, domain)

		expect(signatureData.message.isAuthorized).toBe(false)
	})
})
