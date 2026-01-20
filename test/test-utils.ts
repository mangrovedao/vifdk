import { expect } from 'vitest'

export function expectCloseTo(a: bigint, b: bigint, percentage = 0.01) {
	const diff = Math.abs((Number(a - b) * 100) / Number(a))
	return expect(
		diff,
		`Expected ${a} to be close to ${b} within ${percentage}%`,
	).toBeLessThanOrEqual(percentage)
}
