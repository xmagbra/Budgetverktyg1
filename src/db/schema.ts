import {
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  smallint,
  bigint,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
  role: text("role").notNull().default("user"),
  banned: boolean("banned").default(false),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires", { withTimezone: true }),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonatedBy"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }),
  updatedAt: timestamp("updatedAt", { withTimezone: true }),
});

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const householdMemberships = pgTable(
  "household_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["household_admin", "member"] })
      .notNull()
      .default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("household_memberships_household_user_idx").on(
      table.householdId,
      table.userId,
    ),
  ],
);

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("audit_logs_actor_created_idx").on(table.actorId, table.createdAt)],
);

export const financialAccounts = pgTable(
  "financial_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["checking", "savings", "cash"] }).notNull(),
    openingBalanceMinor: bigint("opening_balance_minor", { mode: "bigint" })
      .notNull(),
    openingBalanceOn: date("opening_balance_on", { mode: "string" }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("financial_accounts_household_idx").on(table.householdId),
    check(
      "financial_accounts_opening_balance_nonnegative",
      sql`${table.openingBalanceMinor} >= 0`,
    ),
  ],
);

export const financeCategories = pgTable(
  "finance_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("finance_categories_household_type_name_idx").on(
      table.householdId,
      table.type,
      table.name,
    ),
  ],
);

export const financeTransactions = pgTable(
  "finance_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => financeCategories.id, { onDelete: "restrict" }),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("finance_transactions_household_date_idx").on(
      table.householdId,
      table.occurredOn,
    ),
    check("finance_transactions_amount_positive", sql`${table.amountMinor} > 0`),
  ],
);

export const financeTransfers = pgTable(
  "finance_transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    sourceAccountId: uuid("source_account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "restrict" }),
    destinationAccountId: uuid("destination_account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "restrict" }),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("finance_transfers_household_date_idx").on(
      table.householdId,
      table.occurredOn,
    ),
    check("finance_transfers_amount_positive", sql`${table.amountMinor} > 0`),
    check(
      "finance_transfers_distinct_accounts",
      sql`${table.sourceAccountId} <> ${table.destinationAccountId}`,
    ),
  ],
);

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    startingPrincipalMinor: bigint("starting_principal_minor", {
      mode: "bigint",
    }).notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    termMonths: integer("term_months").notNull(),
    paymentDay: smallint("payment_day").notNull(),
    repaymentMethod: text("repayment_method", {
      enum: ["annuity", "linear"],
    }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("loans_household_idx").on(table.householdId),
    check("loans_principal_positive", sql`${table.startingPrincipalMinor} > 0`),
    check("loans_term_positive", sql`${table.termMonths} > 0`),
    check("loans_payment_day_range", sql`${table.paymentDay} BETWEEN 1 AND 28`),
  ],
);

export const loanRates = pgTable(
  "loan_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "restrict" }),
    annualRateBps: integer("annual_rate_bps").notNull(),
    effectiveOn: date("effective_on", { mode: "string" }).notNull(),
    changedBy: text("changed_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("loan_rates_loan_effective_idx").on(
      table.loanId,
      table.effectiveOn,
    ),
    check(
      "loan_rates_annual_rate_range",
      sql`${table.annualRateBps} BETWEEN 0 AND 100000`,
    ),
  ],
);

export const loanPayments = pgTable(
  "loan_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "restrict" }),
    sourceAccountId: uuid("source_account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "restrict" }),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    interestMinor: bigint("interest_minor", { mode: "bigint" }).notNull(),
    principalMinor: bigint("principal_minor", { mode: "bigint" }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("loan_payments_loan_paid_idx").on(table.loanId, table.paidOn),
    check("loan_payments_amount_positive", sql`${table.amountMinor} > 0`),
    check("loan_payments_interest_nonnegative", sql`${table.interestMinor} >= 0`),
    check("loan_payments_principal_nonnegative", sql`${table.principalMinor} >= 0`),
    check(
      "loan_payments_amount_matches_parts",
      sql`${table.amountMinor} = ${table.interestMinor} + ${table.principalMinor}`,
    ),
  ],
);
