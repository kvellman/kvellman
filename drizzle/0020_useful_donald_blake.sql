ALTER TABLE "nodes" ADD COLUMN "filter_architectures" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "filter_scopes" text[] DEFAULT '{}' NOT NULL;