CREATE TABLE "nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"enrollment_key_hash" text NOT NULL,
	"token_hash" text,
	"last_seen_at" timestamp with time zone,
	"last_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrolled_at" timestamp with time zone
);
