CREATE TYPE "public"."checkout_status" AS ENUM('authorizing', 'authorized', 'placed', 'declined', 'failed');--> statement-breakpoint
CREATE TABLE "checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"order_id" text,
	"txn_ref_id" text,
	"status" "checkout_status" DEFAULT 'authorizing' NOT NULL,
	"total_amount" numeric(12, 2),
	"currency" text,
	"outcome" text,
	"merchant_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkouts_session" ON "checkouts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "checkouts_user_created" ON "checkouts" USING btree ("user_id","created_at");