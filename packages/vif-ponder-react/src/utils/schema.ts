import { index, onchainTable, primaryKey, relations } from 'ponder'
import { zeroAddress } from 'viem'

type OfferList = (number | string)[]

export const vifInstance = onchainTable('vifInstance', (t) => ({
	chainId: t.integer().primaryKey().notNull(),
	provision: t.integer().default(0).notNull(),
	paused: t.boolean().default(false).notNull(),
	owner: t.hex().default(zeroAddress).notNull(),
}))

export const provisionChange = onchainTable(
	'provisionChange',
	(t) => ({
		chainId: t.integer().notNull(),
		provision: t.integer().notNull(),

		block: t.bigint().notNull(),
		eventIndex: t.integer().notNull(),
		txHash: t.hex().notNull(),
		timestamp: t.timestamp().notNull(),
	}),
	(table) => ({
		pk: primaryKey({ columns: [table.chainId, table.block, table.eventIndex] }),
	}),
)

export const market = onchainTable(
	'market',
	(t) => ({
		id: t.hex().notNull(),
		chainId: t.integer().notNull(),
		outboundToken: t.hex().notNull(),
		inboundToken: t.hex().notNull(),
		outboundUnits: t.bigint().notNull(),
		minOutboundUnits: t.integer().notNull(),
		inboundUnits: t.bigint().notNull(),
		tickSpacing: t.integer().notNull(),
		fees: t.integer().notNull(),

		token0: t.hex().notNull(),
		token1: t.hex().notNull(),

		active: t.boolean().default(true).notNull(),

		offerList: t.jsonb().$type<OfferList>().notNull().default([]),

		lastUpdatedAt: t.timestamp().notNull(),
		lastUpdatedBlock: t.bigint().notNull(),
		lastUpdatedEventIndex: t.integer().notNull(),
		lastUpdatedTxHash: t.hex().notNull(),

		createdAt: t.timestamp().notNull(),
		createdBlock: t.bigint().notNull(),
		createdEventIndex: t.integer().notNull(),
		createdTxHash: t.hex().notNull(),
	}),
	(table) => ({
		pk: primaryKey({ columns: [table.id, table.chainId] }),
	}),
)

export const marketBuckets = onchainTable(
	'marketBuckets',
	(t) => ({
		chainId: t.integer().notNull(),
		token0: t.hex().notNull(),
		token1: t.hex().notNull(),
	}),
	(table) => ({
		pk: primaryKey({ columns: [table.chainId, table.token0, table.token1] }),
	}),
)

export const feeChange = onchainTable(
	'feeChange',
	(t) => ({
		chainId: t.integer().notNull(),
		marketId: t.hex().notNull(),

		fees: t.integer().notNull(),

		block: t.bigint().notNull(),
		eventIndex: t.integer().notNull(),
		txHash: t.hex().notNull(),
		timestamp: t.timestamp().notNull(),
	}),
	(table) => ({
		pk: primaryKey({ columns: [table.chainId, table.block, table.eventIndex] }),
		marketIdIndex: index('fee_change_market_id_index').on(table.marketId),
	}),
)

export const minOutboundUnitsChange = onchainTable(
	'minOutboundUnitsChange',
	(t) => ({
		chainId: t.integer().notNull(),
		marketId: t.hex().notNull(),

		minOutboundUnits: t.integer().notNull(),

		block: t.bigint().notNull(),
		eventIndex: t.integer().notNull(),
		txHash: t.hex().notNull(),
		timestamp: t.timestamp().notNull(),
	}),
	(table) => ({
		pk: primaryKey({ columns: [table.chainId, table.block, table.eventIndex] }),
		marketIdIndex: index('min_outbound_units_change_market_id_index').on(
			table.marketId,
		),
	}),
)

export const marketOrder = onchainTable(
	'marketOrder',
	(t) => ({
		chainId: t.integer().notNull(),
		marketId: t.hex().notNull(),

		taker: t.hex().notNull(),
		got: t.bigint().notNull(),
		gave: t.bigint().notNull(),
		fee: t.bigint().notNull(),
		bounty: t.bigint().notNull(),
		fillVolume: t.bigint().notNull(),
		fillWants: t.boolean().notNull(),
		maxTick: t.integer().notNull(),

		block: t.bigint().notNull(),
		eventIndex: t.integer().notNull(),
		txHash: t.hex().notNull(),
		timestamp: t.timestamp().notNull(),
	}),
	(table) => ({
		pk: primaryKey({ columns: [table.chainId, table.block, table.eventIndex] }),
		timestampIndex: index('market_order_timestamp_index').on(table.timestamp),
		eventIndex: index('market_order_event_index').on(
			table.block,
			table.eventIndex,
		),
		marketIdIndex: index('market_order_market_id_index').on(table.marketId),
		takerIndex: index('market_order_taker_index').on(table.taker),
		marketTimestampIndex: index('market_order_market_timestamp_index').on(
			table.marketId,
			table.timestamp,
		),
	}),
)

export const offerState = onchainTable(
	'offerState',
	(t) => ({
		marketId: t.hex().notNull(),
		chainId: t.integer().notNull(),

		offerId: t.integer().notNull(),
		currentUid: t.uuid(),
		maker: t.hex().notNull(),

		gives: t.bigint().notNull(),
		tick: t.integer().notNull(),
		expiry: t.timestamp(),
		provision: t.integer().notNull(),

		totalGot: t.bigint().default(0n).notNull(),
		totalGave: t.bigint().default(0n).notNull(),
		totalBounty: t.bigint().default(0n).notNull(),

		unclaimedInbound: t.bigint().default(0n).notNull(),
		claimedInbound: t.bigint().default(0n).notNull(),

		createdAt: t.timestamp().notNull(),
		createdBlock: t.bigint().notNull(),
		createdEventIndex: t.integer().notNull(),
		createdTxHash: t.hex().notNull(),

		updatedAt: t.timestamp().notNull(),
		updatedBlock: t.bigint().notNull(),
		updatedEventIndex: t.integer().notNull(),
		updatedTxHash: t.hex().notNull(),
	}),
	(table) => ({
		pk: primaryKey({ columns: [table.chainId, table.marketId, table.offerId] }),
		uidIndex: index('offer_state_uid_index').on(table.currentUid),
		tickIndex: index('offer_state_tick_index').on(table.tick),
		marketIdIndex: index('offer_state_market_id_index').on(table.marketId),
		makerIndex: index('offer_state_maker_index').on(table.maker),
	}),
)

export const offer = onchainTable(
	'offer',
	(t) => ({
		chainId: t.integer().notNull(),
		marketId: t.hex().notNull(),

		offerId: t.integer().notNull(),
		uid: t.uuid().notNull(),
		maker: t.hex().notNull(),

		expiry: t.timestamp(),
		expired: t.boolean().default(false).notNull(),
		cancelled: t.boolean().default(false).notNull(),

		unconsumedGives: t.bigint().notNull(),
		lastTick: t.integer().notNull(),
		got: t.bigint().default(0n).notNull(),
		gave: t.bigint().default(0n).notNull(),
		bounty: t.bigint().default(0n).notNull(),

		createdAt: t.timestamp().notNull(),
		createdBlock: t.bigint().notNull(),
		createdEventIndex: t.integer().notNull(),
		createdTxHash: t.hex().notNull(),

		updatedAt: t.timestamp().notNull(),
		updatedBlock: t.bigint().notNull(),
		updatedEventIndex: t.integer().notNull(),
		updatedTxHash: t.hex().notNull(),
	}),
	(table) => ({
		pk: primaryKey({
			columns: [table.chainId, table.marketId, table.offerId, table.uid],
		}),
		expiryIndex: index('offer_expiry_index').on(table.expiry),
		lastTickIndex: index('offer_last_tick_index').on(table.lastTick),
		createdAtIndex: index('offer_created_at_index').on(table.createdAt),
		makerIndex: index('offer_maker_index').on(table.maker),
	}),
)

export const offerConsumedEvent = onchainTable(
	'offerConsumedEvent',
	(t) => ({
		chainId: t.integer().notNull(),
		marketId: t.hex().notNull(),
		offerId: t.integer().notNull(),
		uid: t.uuid().notNull(),

		gave: t.bigint().notNull(),
		got: t.bigint().notNull(),

		timestamp: t.timestamp().notNull(),
		block: t.bigint().notNull(),
		eventIndex: t.integer().notNull(),
		txHash: t.hex().notNull(),
	}),
	(table) => ({
		pk: primaryKey({
			columns: [table.chainId, table.offerId, table.block, table.eventIndex],
		}),
		timestampIndex: index('offer_consumed_timestamp_index').on(table.timestamp),
		eventIndex: index('offer_consumed_event_index').on(
			table.block,
			table.eventIndex,
		),
		marketIdIndex: index('offer_consumed_market_id_index').on(table.marketId),
		uidIndex: index('offer_consumed_uid_index').on(table.uid),
		marketTimestampIndex: index('offer_consumed_market_timestamp_index').on(
			table.marketId,
			table.timestamp,
		),
	}),
)

export const minutesBucket = onchainTable(
	'minutesBucket',
	(t) => ({
		chainId: t.integer().notNull(),
		token0: t.hex().notNull(),
		token1: t.hex().notNull(),
		bucketIndex: t.timestamp().notNull(),
		firstTradeAt: t.timestamp().notNull(),
		lastTradeAt: t.timestamp().notNull(),
		volume0: t.bigint().notNull(),
		volume1: t.bigint().notNull(),
		fees0: t.bigint().notNull(),
		fees1: t.bigint().notNull(),
		open: t.numeric().notNull(),
		high: t.numeric().notNull(),
		low: t.numeric().notNull(),
		close: t.numeric().notNull(),
	}),
	(table) => ({
		pk: primaryKey({
			columns: [table.chainId, table.token0, table.token1, table.bucketIndex],
		}),
		token0Index: index('minutes_bucket_token0_index').on(table.token0),
		token1Index: index('minutes_bucket_token1_index').on(table.token1),
		bucketIndexIndex: index('minutes_bucket_bucket_index_index').on(
			table.bucketIndex,
		),
	}),
)

export const hoursBucket = onchainTable(
	'hoursBucket',
	(t) => ({
		chainId: t.integer().notNull(),
		token0: t.hex().notNull(),
		token1: t.hex().notNull(),
		bucketIndex: t.timestamp().notNull(),
		firstTradeAt: t.timestamp().notNull(),
		lastTradeAt: t.timestamp().notNull(),
		volume0: t.bigint().notNull(),
		volume1: t.bigint().notNull(),
		fees0: t.bigint().notNull(),
		fees1: t.bigint().notNull(),
		open: t.numeric().notNull(),
		high: t.numeric().notNull(),
		low: t.numeric().notNull(),
		close: t.numeric().notNull(),
	}),
	(table) => ({
		pk: primaryKey({
			columns: [table.chainId, table.token0, table.token1, table.bucketIndex],
		}),
		token0Index: index('hours_bucket_token0_index').on(table.token0),
		token1Index: index('hours_bucket_token1_index').on(table.token1),
		bucketIndexIndex: index('hours_bucket_bucket_index_index').on(
			table.bucketIndex,
		),
	}),
)

// Relationships

export const marketsRelations = relations(market, ({ one, many }) => ({
	feeChanges: many(feeChange),
	minOutboundUnitsChanges: many(minOutboundUnitsChange),
	offers: many(offer),
	offerStates: many(offerState),
	marketOrders: many(marketOrder),
	offerConsumedEvents: many(offerConsumedEvent),
	buckets: one(marketBuckets, {
		fields: [market.chainId, market.token0, market.token1],
		references: [
			marketBuckets.chainId,
			marketBuckets.token0,
			marketBuckets.token1,
		],
	}),
}))

export const feeChangesRelations = relations(feeChange, ({ one }) => ({
	market: one(market, {
		fields: [feeChange.chainId, feeChange.marketId],
		references: [market.chainId, market.id],
	}),
}))

export const minOutboundUnitsChangesRelations = relations(
	minOutboundUnitsChange,
	({ one }) => ({
		market: one(market, {
			fields: [minOutboundUnitsChange.chainId, minOutboundUnitsChange.marketId],
			references: [market.chainId, market.id],
		}),
	}),
)

export const offersRelations = relations(offer, ({ one, many }) => ({
	market: one(market, {
		fields: [offer.chainId, offer.marketId],
		references: [market.chainId, market.id],
	}),
	offerState: one(offerState, {
		fields: [offer.chainId, offer.marketId, offer.offerId],
		references: [offerState.chainId, offerState.marketId, offerState.offerId],
	}),
	offerConsumedEvents: many(offerConsumedEvent),
}))

export const offerStatesRelations = relations(offerState, ({ many, one }) => ({
	offers: many(offer),
	currentOffer: one(offer, {
		fields: [
			offerState.chainId,
			offerState.marketId,
			offerState.offerId,
			offerState.currentUid,
		],
		references: [offer.chainId, offer.marketId, offer.offerId, offer.uid],
	}),
	offerConsumedEvents: many(offerConsumedEvent),
	market: one(market, {
		fields: [offerState.chainId, offerState.marketId],
		references: [market.chainId, market.id],
	}),
}))

export const marketOrdersRelations = relations(
	marketOrder,
	({ one, many }) => ({
		market: one(market, {
			fields: [marketOrder.chainId, marketOrder.marketId],
			references: [market.chainId, market.id],
		}),
		offerConsumedEvents: many(offerConsumedEvent),
	}),
)

export const offerConsumedEventsRelations = relations(
	offerConsumedEvent,
	({ one }) => ({
		market: one(market, {
			fields: [offerConsumedEvent.chainId, offerConsumedEvent.marketId],
			references: [market.chainId, market.id],
		}),
		offer: one(offer, {
			fields: [
				offerConsumedEvent.chainId,
				offerConsumedEvent.marketId,
				offerConsumedEvent.offerId,
			],
			references: [offer.chainId, offer.marketId, offer.offerId],
		}),
		offerState: one(offerState, {
			fields: [
				offerConsumedEvent.chainId,
				offerConsumedEvent.marketId,
				offerConsumedEvent.offerId,
			],
			references: [offerState.chainId, offerState.marketId, offerState.offerId],
		}),
		marketOrder: one(marketOrder, {
			fields: [
				offerConsumedEvent.chainId,
				offerConsumedEvent.block,
				offerConsumedEvent.eventIndex,
			],
			references: [
				marketOrder.chainId,
				marketOrder.block,
				marketOrder.eventIndex,
			],
		}),
	}),
)

export const marketBucketsRelations = relations(marketBuckets, ({ many }) => ({
	markets: many(market),
	minutesBuckets: many(minutesBucket),
	hoursBuckets: many(hoursBucket),
}))

export const minutesBucketsRelations = relations(minutesBucket, ({ one }) => ({
	markets: one(marketBuckets, {
		fields: [minutesBucket.chainId, minutesBucket.token0, minutesBucket.token1],
		references: [
			marketBuckets.chainId,
			marketBuckets.token0,
			marketBuckets.token1,
		],
	}),
}))

export const hoursBucketsRelations = relations(hoursBucket, ({ one }) => ({
	markets: one(marketBuckets, {
		fields: [hoursBucket.chainId, hoursBucket.token0, hoursBucket.token1],
		references: [
			marketBuckets.chainId,
			marketBuckets.token0,
			marketBuckets.token1,
		],
	}),
}))
