ALTER TABLE "versions" ADD COLUMN "approval_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "review_note" text;--> statement-breakpoint
-- Backfill: versions that already existed before the approval gate were effectively live, so
-- mark them approved to preserve current delivery behavior. New versions default to 'pending'.
UPDATE "versions" SET "approval_status" = 'approved', "reviewed_by" = 'system', "reviewed_at" = now();
