CREATE TABLE "merch_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"price" integer NOT NULL,
	"image_url" text NOT NULL,
	"category" text NOT NULL,
	"preorder" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "merch_products_slug_unique" ON "merch_products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "merch_products_published_sort_idx" ON "merch_products" USING btree ("published","sort_order");