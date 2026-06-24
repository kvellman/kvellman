ALTER TABLE "locales" ALTER COLUMN "publisher" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "locales" ALTER COLUMN "package_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "locales" ALTER COLUMN "short_description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "locales" ALTER COLUMN "license" DROP NOT NULL;