CREATE TABLE "admin_access" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_email" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_vote_options_vote_order_unique";--> statement-breakpoint
DROP INDEX "idx_vote_options_shortcut_unique";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vote_options" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "events"
SET "slug" = left(
	coalesce(
		nullif(
			trim(both '-' from regexp_replace(
				lower(translate("name", 'ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇáàâäãåéèêëíìîïóòôöõúùûüñç', 'AAAAAAEEEEIIIIOOOOOUUUUNCaaaaaaeeeeiiiiooooouuuunc')),
				'[^a-z0-9]+',
				'-',
				'g'
			)),
			''
		),
		'evento'
	),
	70
) || '-' || left("id", 8);--> statement-breakpoint
UPDATE "votes"
SET "slug" = left(
	coalesce(
		nullif(
			trim(both '-' from regexp_replace(
				lower(translate("name", 'ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇáàâäãåéèêëíìîïóòôöõúùûüñç', 'AAAAAAEEEEIIIIOOOOOUUUUNCaaaaaaeeeeiiiiooooouuuunc')),
				'[^a-z0-9]+',
				'-',
				'g'
			)),
			''
		),
		'votacion'
	),
	70
) || '-' || left("id", 8);--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "votes" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_admin_access_email_unique" ON "admin_access" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_audit_log_target" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_idempotency_keys_scope_key_unique" ON "idempotency_keys" USING btree ("scope","key");--> statement-breakpoint
CREATE INDEX "idx_idempotency_keys_expires_at" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_events_slug_unique_active" ON "events" USING btree ("slug") WHERE "events"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_votes_slug_unique_active" ON "votes" USING btree ("slug") WHERE "votes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vote_options_vote_order_unique" ON "vote_options" USING btree ("vote_id","order") WHERE "vote_options"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vote_options_shortcut_unique" ON "vote_options" USING btree ("vote_id","shortcut") WHERE "vote_options"."shortcut" IS NOT NULL AND "vote_options"."deleted_at" IS NULL;
