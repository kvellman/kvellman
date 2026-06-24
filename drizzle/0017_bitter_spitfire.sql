CREATE TABLE "plugin_data" (
	"plugin" text NOT NULL,
	"user_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	CONSTRAINT "plugin_data_plugin_user_id_key_pk" PRIMARY KEY("plugin","user_id","key")
);
--> statement-breakpoint
ALTER TABLE "plugin_data" ADD CONSTRAINT "plugin_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;