CREATE TYPE "public"."item_tier" AS ENUM('buyable', 'deeplink');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('instagram', 'whatsapp', 'share_target');--> statement-breakpoint
CREATE TYPE "public"."resolution" AS ENUM('exact', 'similar', 'none');--> statement-breakpoint
CREATE TYPE "public"."share_status" AS ENUM('queued', 'resolving', 'resolved', 'failed');--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"tier" "item_tier" NOT NULL,
	"title" text NOT NULL,
	"merchant" text,
	"merchant_domain" text,
	"price_amount" numeric(12, 2),
	"currency" text,
	"image_url" text,
	"product_url" text NOT NULL,
	"catalog_product_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"source_url" text NOT NULL,
	"message_id" text,
	"raw_payload" jsonb,
	"status" "share_status" DEFAULT 'queued' NOT NULL,
	"resolution" "resolution",
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "identities_platform_external_id" ON "identities" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "items_share_rank" ON "items" USING btree ("share_id","rank");--> statement-breakpoint
CREATE INDEX "shares_user_created" ON "shares" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "shares_status" ON "shares" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "shares_dedupe" ON "shares" USING btree ("platform","message_id","source_url");