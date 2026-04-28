ALTER TABLE "vote_options" ADD COLUMN "can_win" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "minimum_votes" integer;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "max_winners" integer;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_minimum_votes_positive" CHECK ("votes"."minimum_votes" IS NULL OR "votes"."minimum_votes" > 0);--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_max_winners_positive" CHECK ("votes"."max_winners" IS NULL OR "votes"."max_winners" > 0);