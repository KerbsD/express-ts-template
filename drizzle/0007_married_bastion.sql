CREATE TABLE "portfolio_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text NOT NULL,
	"style" text DEFAULT '' NOT NULL,
	"artist" text DEFAULT '' NOT NULL,
	"duration" text DEFAULT '' NOT NULL,
	"date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "portfolio_items_published_sort_idx" ON "portfolio_items" USING btree ("published","sort_order");