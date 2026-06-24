CREATE TABLE "telemetry_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"package_identifier" text,
	"package_version" text,
	"site" text,
	"winget_version" text,
	"source_ip" text
);
