ALTER TABLE "destinations" ALTER COLUMN "forfait_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "forfait_screenshot" "bytea";--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "forfait_screenshot_mime" text;