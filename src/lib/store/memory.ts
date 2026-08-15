import { config } from "@/lib/config";
import type { StoreRepo } from "@/lib/store/types-repo";
import type { CardMandate, Order, StoreRecord } from "@/lib/store/types";

type Db = {
  stores: Map<string, StoreRecord>;
  orders: Map<string, Order>;
  mandates: Map<string, CardMandate>;
};

const globalForDb = globalThis as typeof globalThis & { __aisleDb?: Db };

function seed(): Db {
  const stores = new Map<string, StoreRecord>();
  const orders = new Map<string, Order>();
  const mandates = new Map<string, CardMandate>();
  stores.set("hackathon-shirts", {
    slug: "hackathon-shirts",
    name: "StraitsX Hackathon Shirts",
    merchantAddress: config.merchantAddress,
    createdAt: new Date().toISOString(),
    skus: [
      {
        id: "shirt",
        title: "StraitsX Hackathon Shirt",
        description: "Official AgentiX Playground tee. Priced in XSGD.",
        quantity: 50,
        price: "5.00",
      },
    ],
  });
  return { stores, orders, mandates };
}

function db(): Db {
  if (!globalForDb.__aisleDb) {
    globalForDb.__aisleDb = seed();
  }
  const current = globalForDb.__aisleDb as Db & {
    mandates?: Map<string, CardMandate>;
  };
  if (!current.mandates) {
    current.mandates = new Map();
  }
  return current;
}

export const memoryRepo: StoreRepo = {
  async listStores() {
    return [...db().stores.values()];
  },
  async getStore(slug) {
    return db().stores.get(slug) ?? null;
  },
  async putStore(store) {
    db().stores.set(store.slug, store);
    return store;
  },
  async listOrders(slug) {
    const all = [...db().orders.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return slug ? all.filter((o) => o.slug === slug) : all;
  },
  async getOrder(id) {
    return db().orders.get(id) ?? null;
  },
  async putOrder(order) {
    db().orders.set(order.id, order);
    return order;
  },
  async getMandate(cardOpaqueId) {
    return db().mandates.get(cardOpaqueId) ?? null;
  },
  async putMandate(mandate) {
    if (mandate.cardOpaqueId) {
      db().mandates.set(mandate.cardOpaqueId, mandate);
    }
    return mandate;
  },
  async burnMandate(cardOpaqueId) {
    const existing = db().mandates.get(cardOpaqueId);
    if (!existing) return null;
    const burned: CardMandate = {
      ...existing,
      status: "burned",
      burnedAt: new Date().toISOString(),
    };
    db().mandates.set(cardOpaqueId, burned);
    return burned;
  },
};
