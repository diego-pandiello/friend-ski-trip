CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "accommodations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"name" text,
	"description" text,
	"beds" integer,
	"bedrooms" integer,
	"bathrooms" integer,
	"distance_km" numeric(6, 1),
	"total_price" numeric(10, 2),
	"screenshot" "bytea",
	"screenshot_mime" text,
	"status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"maps_url" text NOT NULL,
	"forfait_url" text NOT NULL,
	"name" text,
	"lat" double precision,
	"lng" double precision,
	"drive_minutes" integer,
	"forfait_price" numeric(10, 2),
	"forfait_days" integer,
	"status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"ski_days" integer NOT NULL,
	"travelers" integer NOT NULL,
	"photo" "bytea",
	"photo_mime" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_created_by_participants_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_created_by_participants_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "participants_trip_name_idx" ON "participants" USING btree ("trip_id",lower("name"));