import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

const cuid = () => createId()

// ─── Events ──────────────────────────────────────────────────────────────────

export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    name: text('name').notNull(),
    banner: text('banner'),
    startDate: timestamp('start_date', { withTimezone: true, mode: 'string' }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true, mode: 'string' }).notNull(),
    visible: boolean('visible').default(true).notNull(),
    order: integer('order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    index('idx_events_visible_order').on(table.visible, table.order),
    index('idx_events_start_date').on(table.startDate),
    check('events_date_range_valid', sql`${table.startDate} <= ${table.endDate}`),
  ]
)

// ─── Votes ───────────────────────────────────────────────────────────────────

export const votes = pgTable(
  'votes',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    visible: boolean('visible').default(true).notNull(),
    open: boolean('open').default(false).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
    order: integer('order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    index('idx_votes_event_id').on(table.eventId),
    index('idx_votes_open').on(table.open),
    index('idx_votes_visible_order').on(table.visible, table.order),
    uniqueIndex('idx_votes_single_open_global')
      .on(table.open)
      .where(sql`${table.open} IS TRUE`),
  ]
)

// ─── Vote Options ────────────────────────────────────────────────────────────

export const voteOptions = pgTable(
  'vote_options',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    voteId: text('vote_id')
      .notNull()
      .references(() => votes.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    color: text('color'),
    count: integer('count').default(0).notNull(),
    order: integer('order').default(0).notNull(),
    shortcut: text('shortcut'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    index('idx_vote_options_vote_id').on(table.voteId),
    index('idx_vote_options_order').on(table.order),
    uniqueIndex('idx_vote_options_vote_order_unique').on(table.voteId, table.order),
    uniqueIndex('idx_vote_options_shortcut_unique')
      .on(table.voteId, table.shortcut)
      .where(sql`${table.shortcut} IS NOT NULL`),
    check('vote_options_count_non_negative', sql`${table.count} >= 0`),
  ]
)

// ─── Better Auth Tables ──────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
})

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('idx_sessions_user_id').on(table.userId),
    index('idx_sessions_expires_at').on(table.expiresAt),
  ]
)

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [index('idx_accounts_user_id').on(table.userId)]
)

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [index('idx_verifications_expires_at').on(table.expiresAt)]
)

// ─── Relations ───────────────────────────────────────────────────────────────

export const eventsRelations = relations(events, ({ many }) => ({
  votes: many(votes),
}))

export const votesRelations = relations(votes, ({ one, many }) => ({
  event: one(events, {
    fields: [votes.eventId],
    references: [events.id],
  }),
  options: many(voteOptions),
}))

export const voteOptionsRelations = relations(voteOptions, ({ one }) => ({
  vote: one(votes, {
    fields: [voteOptions.voteId],
    references: [votes.id],
  }),
}))

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))
