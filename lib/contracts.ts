/** Money is stored in integer MXN centavos. Times are ISO 8601 with timezone. */
export type Role = "OWNER" | "ADMIN" | "KITCHEN";
export type Channel =
  | "store"
  | "whatsapp"
  | "uber"
  | "rappi"
  | "didi"
  | "other";
export type Mode = "pickup" | "delivery";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "baking"
  | "ready"
  | "dispatched"
  | "delivered"
  | "picked_up"
  | "cancelled"
  | "review";
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  ingredients: string[];
  removable: string[];
  available: boolean;
  archived: boolean;
  position: number;
}
export interface Settings {
  open: boolean;
  pickup: boolean;
  delivery: boolean;
  ovenMinutes: number;
  ovenCapacity: number;
  temperature: number;
  maxActiveUnits: number;
  limitDough: boolean;
  homeTitle: string;
  homeDescription: string;
  banner: string;
  hours: string;
  businessName: string;
  notificationEmail: string;
  notifications: Record<string, boolean>;
}
export interface Zone {
  id: string;
  name: string;
  fee: number;
  postcodes: string[];
  enabled: boolean;
}
export interface Promotion {
  id: string;
  code: string;
  percent: number;
  enabled: boolean;
}
export interface Menu {
  commercial?: import("./sales-channels").StorefrontChannels;
  products: Product[];
  settings: Pick<
    Settings,
    | "open"
    | "pickup"
    | "delivery"
    | "homeTitle"
    | "homeDescription"
    | "banner"
    | "hours"
    | "businessName"
  >;
  zones: Zone[];
  promotions: Promotion[];
}
export interface CartLine {
  productId: string;
  quantity: number;
  removed: string[];
  note: string;
}
export interface CheckoutInput {
  expectedTotal?: number;
  items: CartLine[];
  name: string;
  phone: string;
  email: string;
  mode: Mode;
  address?: string;
  postcode?: string;
  zoneId?: string;
  references?: string;
  notes?: string;
  promoCode?: string;
}
export interface CheckoutResult {
  id: string;
  token: string;
  number: number;
  total: number;
  subtotal: number;
  fee: number;
  discount: number;
  expiresAt: string;
  status: OrderStatus;
}
export interface Tracking {
  number: number;
  status: OrderStatus;
  mode: Mode;
  paymentStatus: string;
  updatedAt: string;
}
export interface Unit {
  id: string;
  image?: string;
  name: string;
  removed: string[];
  note: string;
  status: "queued" | "baking" | "ready";
  startedAt: string | null;
  endsAt: string | null;
}
export interface KitchenOrder {
  id: string;
  number: number;
  status: OrderStatus;
  mode: Mode;
  paymentStatus: string;
  paidAt: string;
  units: Unit[];
}
export interface KitchenData {
  orders: KitchenOrder[];
  settings: Pick<
    Settings,
    "ovenMinutes" | "ovenCapacity" | "temperature" | "open"
  >;
}
export interface Ingredient {
  id: string;
  name: string;
  unit: "g" | "ml" | "pz";
  stock: number;
  minimum: number;
  supplier: string;
  purchaseQuantity: number;
  purchasePrice: number;
  purchaseDate: string | null;
  purchaseUnit: string;
  presentation: string;
  unitCost: number | null;
}
export interface RecipeItem {
  ingredientId: string;
  quantity: number;
  unit: string;
  category: "masa" | "salsa" | "toppings" | "empaque" | "otros";
}
export interface Recipe {
  productId: string;
  complete: boolean;
  items: RecipeItem[];
  cost: number | null;
  partialCost: number;
}
export interface Dough {
  id: string;
  preparedAt: string;
  flour: number;
  hydration: number;
  yeast: number;
  salt: number;
  ballWeight: number;
  balls: number;
  remaining: number;
  held?: number;
  used?: number;
  waste?: number;
  fermentStart: string;
  fermentHours: number;
  expiresAt: string;
  status: string;
}
export interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  receipt: string;
}
export interface FinanceSale {
  id: string;
  date: string;
  channel: Channel;
  gross: number;
  discount: number;
  refund: number;
  fee: number | null;
  cost: number | null;
  units: number;
  productSales: { name: string; quantity: number; amount: number }[];
}
export interface ChannelConfig {
  presentation?: Partial<import("./sales-channels").DirectBanner & import("./sales-channels").PlatformCard>;
  productPrices?: Record<string, number>;
  id: Channel;
  name: string;
  commission: number | null;
}
export interface AdminOrder extends KitchenOrder {
  total: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  references: string;
  notes: string;
  createdAt: string;
}
export interface Movement {
  id: string;
  ingredientId: string;
  type: string;
  quantity: number;
  date: string;
  reason: string;
}
export interface Purchase {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  price: number;
  date: string;
  supplier: string;
}
export interface AdminData {
  purchases: Purchase[];
  settings: Settings;
  products: Product[];
  zones: Zone[];
  promotions: Promotion[];
  orders: AdminOrder[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  dough: Dough[];
  expenses: Expense[];
  sales: FinanceSale[];
  channels: ChannelConfig[];
  movements: Movement[];
}
export interface PaymentUpdate {
  eventId: string;
  paymentId: string;
  orderId: string;
  status:
    | "approved"
    | "pending"
    | "rejected"
    | "cancelled"
    | "refunded"
    | "charged_back";
  amount: number;
  currency: string;
  refunded?: number;
  fee?: number;
  updatedAt: string;
}
export interface Notification {
  id: string;
  type: string;
  to: string;
  subject: string;
  orderId: string | null;
  payload: {
    number?: number;
    token?: string;
    total?: number;
    mode?: Mode;
    products?: string[];
    detail?: string;
  };
  attempts: number;
  createdAt: string;
}
