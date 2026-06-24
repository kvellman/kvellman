CREATE TABLE "upstream_catalog" (
	"package_identifier" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"moniker" text,
	"latest_version" text
);
