ALTER TABLE "nodes" ADD COLUMN "cert_fingerprint" text;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "cert_not_after" timestamp with time zone;