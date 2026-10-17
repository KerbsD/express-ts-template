CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
DROP INDEX "users_refresh_token_idx";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_verification_sent_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "reset_password_sent_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_token_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_password_token_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_password_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_family_id_idx" ON "sessions" USING btree ("family_id");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "refresh_token";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "verification_token";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "reset_password_token";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_verification_token_hash_unique" UNIQUE("verification_token_hash");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_reset_password_token_hash_unique" UNIQUE("reset_password_token_hash");