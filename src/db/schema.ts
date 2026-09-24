import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  tagline: text("tagline").notNull(),
  pieces: integer("pieces").notNull().default(1),
  pricePkr: integer("price_pkr").notNull(),
  available: boolean("available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  customerName: varchar("customer_name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  village: varchar("village", { length: 64 }).notNull(),
  address: text("address").notNull(),
  deliverySlot: varchar("delivery_slot", { length: 32 }).notNull(),
  notes: text("notes"),
  totalPkr: integer("total_pkr").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("received"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  productName: varchar("product_name", { length: 120 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPricePkr: integer("unit_price_pkr").notNull(),
});

export const assets = pgTable("assets", {
  key: varchar("key", { length: 64 }).primaryKey(),
  mime: varchar("mime", { length: 64 }).notNull(),
  data: text("data").notNull(), // base64
  bytes: integer("bytes").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Asset = typeof assets.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

export const ORDER_STATUSES = [
  "received",
  "baking",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
