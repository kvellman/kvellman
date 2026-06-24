CREATE TABLE "audit_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"package_identifier" text,
	"package_version" text,
	"detail" jsonb
);
