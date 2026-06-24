CREATE TABLE "installers" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_id" integer NOT NULL,
	"architecture" text NOT NULL,
	"installer_type" text NOT NULL,
	"installer_url" text NOT NULL,
	"installer_sha256" text NOT NULL,
	"scope" text,
	"installer_switches" jsonb,
	"local_file" text
);
--> statement-breakpoint
CREATE TABLE "locales" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_id" integer NOT NULL,
	"package_locale" text NOT NULL,
	"publisher" text NOT NULL,
	"package_name" text NOT NULL,
	"short_description" text NOT NULL,
	"license" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"moniker" text,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_identifier" text NOT NULL,
	"package_name" text NOT NULL,
	"publisher" text NOT NULL,
	"moniker" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "packages_package_identifier_unique" UNIQUE("package_identifier")
);
--> statement-breakpoint
CREATE TABLE "site_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"site" text NOT NULL,
	"location" text NOT NULL,
	"default_locale" text NOT NULL,
	"repo_url" text NOT NULL,
	"mirror_locally" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" integer NOT NULL,
	"package_version" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "installers" ADD CONSTRAINT "installers_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locales" ADD CONSTRAINT "locales_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Trigram search support for manifestSearch: substring/fuzzy via pg_trgm.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "packages_package_name_trgm" ON "packages" USING gin ("package_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "packages_package_identifier_trgm" ON "packages" USING gin ("package_identifier" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "packages_moniker_trgm" ON "packages" USING gin ("moniker" gin_trgm_ops);