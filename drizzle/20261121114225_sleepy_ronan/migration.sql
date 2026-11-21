CREATE TYPE "currency_code" AS ENUM('SGD', 'USD', 'INR', 'MYR', 'EUR', 'GBP');--> statement-breakpoint
CREATE TYPE "entry_type" AS ENUM('Out', 'In');--> statement-breakpoint
CREATE TYPE "insight_kind" AS ENUM('summary', 'alerts', 'tips');--> statement-breakpoint
CREATE TYPE "layout_mode" AS ENUM('auto', 'phone', 'laptop');--> statement-breakpoint
CREATE TABLE "ai_insights" (
	"month_id" uuid,
	"kind" "insight_kind",
	"payload" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_insights_pkey" PRIMARY KEY("month_id","kind")
);
--> statement-breakpoint
CREATE TABLE "budget_lines" (
	"user_id" text,
	"month_key" text,
	"category_name" text,
	"amount_cents" integer NOT NULL,
	CONSTRAINT "budget_lines_pkey" PRIMARY KEY("user_id","month_key","category_name"),
	CONSTRAINT "budget_lines_amount_non_negative" CHECK ("amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"month_id" uuid NOT NULL,
	"type" "entry_type" NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_not_blank" CHECK (length(trim("name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "currency_rates" (
	"user_id" text,
	"code" "currency_code",
	"rate" numeric(12,6) NOT NULL,
	CONSTRAINT "currency_rates_pkey" PRIMARY KEY("user_id","code"),
	CONSTRAINT "currency_rates_rate_positive" CHECK ("rate" > 0),
	CONSTRAINT "currency_rates_not_base" CHECK ("code" <> 'SGD')
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"category_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entries_amount_non_negative" CHECK ("amount_cents" >= 0),
	CONSTRAINT "entries_label_not_blank" CHECK (length(trim("label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "month_plans" (
	"user_id" text,
	"month_key" text,
	"expected_income_cents" integer,
	"ai_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "month_plans_pkey" PRIMARY KEY("user_id","month_key"),
	CONSTRAINT "month_plans_expected_income_non_negative" CHECK ("expected_income_cents" IS NULL OR "expected_income_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "months" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"sort_index" integer NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "months_user_key_unique" UNIQUE("user_id","key"),
	CONSTRAINT "months_key_not_blank" CHECK (length(trim("key")) > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"currency" "currency_code" DEFAULT 'SGD'::"currency_code" NOT NULL,
	"layout" "layout_mode" DEFAULT 'auto'::"layout_mode" NOT NULL,
	"show_audit" boolean DEFAULT true NOT NULL,
	"compact_cards" boolean DEFAULT false NOT NULL,
	"auto_categorise" boolean DEFAULT true NOT NULL,
	"active_month_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "categories_month_type_name_unique" ON "categories" ("month_id","type",lower("name"));--> statement-breakpoint
CREATE INDEX "categories_month_type_position_idx" ON "categories" ("month_id","type","position");--> statement-breakpoint
CREATE INDEX "entries_category_idx" ON "entries" ("category_id");--> statement-breakpoint
CREATE INDEX "months_user_sort_idx" ON "months" ("user_id","sort_index");--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_month_id_months_id_fkey" FOREIGN KEY ("month_id") REFERENCES "months"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_month_plan_fk" FOREIGN KEY ("user_id","month_key") REFERENCES "month_plans"("user_id","month_key") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_month_id_months_id_fkey" FOREIGN KEY ("month_id") REFERENCES "months"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "currency_rates" ADD CONSTRAINT "currency_rates_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "month_plans" ADD CONSTRAINT "month_plans_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_active_month_id_months_id_fkey" FOREIGN KEY ("active_month_id") REFERENCES "months"("id") ON DELETE SET NULL;