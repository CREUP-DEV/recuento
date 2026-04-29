DROP INDEX "idx_vote_options_order";--> statement-breakpoint
CREATE INDEX "idx_vote_options_vote_can_win" ON "vote_options" USING btree ("vote_id","can_win");--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_timeline_valid" CHECK ("votes"."started_at" IS NULL OR "votes"."ended_at" IS NULL OR "votes"."ended_at" > "votes"."started_at");