import { describe, expect, it } from 'bun:test'
import type { Address } from 'viem'
import { formatUnits, parseUnits } from 'viem'
import {
	Token,
	UnitOverflowError as TokenUnitOverflowError,
} from '../../core/src/lib/token'

const WETH_ADDRESS: Address = '0x0000000000000000000000000000000000000001'
const USDC_ADDRESS: Address = '0x0000000000000000000000000000000000000002'

const WETH_DECIMALS = 18
const USDC_DECIMALS = 6

// Example units provided by user
const WETH_UNIT = 10n ** 14n // 0.0001 ETH in wei granularity
const USDC_UNIT = 10n // 10 micro-units granularity (0.00001 USDC)

describe('Token.from', () => {
	it('creates WETH and USDC tokens with provided units', () => {
		expect(() =>
			Token.from(WETH_ADDRESS, WETH_DECIMALS, 'WETH', WETH_UNIT),
		).not.toThrow()
		expect(() =>
			Token.from(USDC_ADDRESS, USDC_DECIMALS, 'USDC', USDC_UNIT),
		).not.toThrow()
	})

	it('throws on unit overflow (>= 2^64)', () => {
		const tooLargeUnit = 2n ** 64n // just above max for 64 bits
		expect(() =>
			Token.from(WETH_ADDRESS, WETH_DECIMALS, 'BAD', tooLargeUnit),
		).toThrow(TokenUnitOverflowError)
	})
})

describe('Token.amount (string)', () => {
	it('WETH: exact 1 ETH remains unchanged and aligns to unit', () => {
		const weth = Token.from(WETH_ADDRESS, WETH_DECIMALS, 'WETH', WETH_UNIT)
		const amt = weth.amount('1')
		expect(amt.amount).toBe(parseUnits('1', WETH_DECIMALS))
	})

	it('WETH: tiny fractional remainder below unit is truncated', () => {
		const weth = Token.from(WETH_ADDRESS, WETH_DECIMALS, 'WETH', WETH_UNIT)
		const amt = weth.amount('1.000000000000000123')
		// after truncation to 1e14 wei granularity -> exactly 1 ETH
		expect(amt.amount).toBe(parseUnits('1', WETH_DECIMALS))
	})

	it('WETH: arbitrary value is snapped to 1e14 wei granularity', () => {
		const weth = Token.from(WETH_ADDRESS, WETH_DECIMALS, 'WETH', WETH_UNIT)
		const amt = weth.amount('1.234567890123456789')
		// snap to 1234567890123400000 wei (drop digits below units)
		expect(amt.amount).toBe(
			1234567890123456789n - (1234567890123456789n % WETH_UNIT),
		)
		// round-trip string reflects snapping
		expect(amt.amountString).toBe(
			formatUnits(
				1234567890123456789n - (1234567890123456789n % WETH_UNIT),
				WETH_DECIMALS,
			),
		)
	})

	it('USDC: value is snapped to 10 micro-units granularity', () => {
		const usdc = Token.from(USDC_ADDRESS, USDC_DECIMALS, 'USDC', USDC_UNIT)
		const amt = usdc.amount('1.234567') // 1_234_567 micro-units
		expect(amt.amount).toBe(1234560n) // snapped down to nearest multiple of 10
		expect(amt.amountString).toBe('1.23456')
	})
})

describe('Token.amount (bigint)', () => {
	it('USDC: bigint input is also snapped to unit', () => {
		const usdc = Token.from(USDC_ADDRESS, USDC_DECIMALS, 'USDC', USDC_UNIT)
		const amt = usdc.amount(1234567n)
		expect(amt.amount).toBe(1234560n)
	})
})

describe('TokenAmount.amountString setter', () => {
	it('parses and snaps to token unit', () => {
		const usdc = Token.from(USDC_ADDRESS, USDC_DECIMALS, 'USDC', USDC_UNIT)
		const amt = usdc.amount(0n)
		amt.amountString = '1.234567'
		expect(amt.amount).toBe(1234560n)
		expect(amt.amountString).toBe('1.23456')
	})
})
