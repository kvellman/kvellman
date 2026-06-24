CREATE TABLE "node_cache_removals" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" integer NOT NULL,
	"package_identifier" text NOT NULL,
	"package_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "node_cache_removals_node_id_package_identifier_package_version_unique" UNIQUE("node_id","package_identifier","package_version")
);
--> statement-breakpoint
ALTER TABLE "node_cache_removals" ADD CONSTRAINT "node_cache_removals_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;