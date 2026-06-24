CREATE TABLE "telemetry_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"event_type" text NOT NULL,
	"package_identifier" text,
	"package_version" text,
	"site" text,
	"winget_version" text,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "telemetry_daily_day_idx" ON "telemetry_daily" USING btree ("day");