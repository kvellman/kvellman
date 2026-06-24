CREATE TABLE "node_mirror_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" integer NOT NULL,
	"package_identifier" text NOT NULL,
	"package_version" text NOT NULL,
	"urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "node_mirror_requests_node_id_package_identifier_package_version_unique" UNIQUE("node_id","package_identifier","package_version")
);
--> statement-breakpoint
ALTER TABLE "node_mirror_requests" ADD CONSTRAINT "node_mirror_requests_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;