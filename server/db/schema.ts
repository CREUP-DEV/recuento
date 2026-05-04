import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
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
    slug: text('slug').notNull(),
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
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_events_visible_order').on(table.visible, table.order),
    index('idx_events_start_date').on(table.startDate),
    uniqueIndex('idx_events_slug_unique_active')
      .on(table.slug)
      .where(sql`${table.deletedAt} IS NULL`),
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
    slug: text('slug').notNull(),
    visible: boolean('visible').default(true).notNull(),
    open: boolean('open').default(false).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
    order: integer('order').default(0).notNull(),
    minimumVotes: integer('minimum_votes'),
    maxWinners: integer('max_winners'),
    confettiEnabled: boolean('confetti_enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_votes_event_id').on(table.eventId),
    index('idx_votes_open').on(table.open),
    index('idx_votes_visible_order').on(table.visible, table.order),
    uniqueIndex('idx_votes_event_slug_unique_active')
      .on(table.eventId, table.slug)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex('idx_votes_single_open_global')
      .on(table.open)
      .where(sql`${table.open} IS TRUE`),
    check(
      'votes_minimum_votes_positive',
      sql`${table.minimumVotes} IS NULL OR ${table.minimumVotes} > 0`
    ),
    check(
      'votes_max_winners_positive',
      sql`${table.maxWinners} IS NULL OR ${table.maxWinners} > 0`
    ),
    check(
      'votes_timeline_valid',
      sql`${table.startedAt} IS NULL OR ${table.endedAt} IS NULL OR ${table.endedAt} > ${table.startedAt}`
    ),
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
    canWin: boolean('can_win').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_vote_options_vote_id').on(table.voteId),
    index('idx_vote_options_vote_can_win').on(table.voteId, table.canWin),
    uniqueIndex('idx_vote_options_vote_order_unique')
      .on(table.voteId, table.order)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex('idx_vote_options_shortcut_unique')
      .on(table.voteId, table.shortcut)
      .where(sql`${table.shortcut} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    check('vote_options_count_non_negative', sql`${table.count} >= 0`),
  ]
)

// ─── Admin Access And Audit ──────────────────────────────────────────────────

export const adminAccess = pgTable(
  'admin_access',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    email: text('email').notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [uniqueIndex('idx_admin_access_email_unique').on(table.email)]
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_log_target').on(table.targetType, table.targetId),
    index('idx_audit_log_created_at').on(table.createdAt),
  ]
)

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_idempotency_keys_scope_key_unique').on(table.scope, table.key),
    index('idx_idempotency_keys_expires_at').on(table.expiresAt),
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
