ALTER TABLE "nodes" ADD COLUMN "scope_all" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "scope_packages" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "scope_tags" text[] DEFAULT '{}' NOT NULL;