import { memoryRepo } from "@/lib/store/memory";
import type { StoreRepo } from "@/lib/store/types-repo";

function useDynamo() {
  return Boolean(process.env.AISLE_TABLE?.trim());
}

let dynamo: StoreRepo | null = null;

async function backend(): Promise<StoreRepo> {
  if (!useDynamo()) return memoryRepo;
  if (!dynamo) {
    const mod = await import("@/lib/store/dynamo");
    dynamo = mod.dynamoRepo;
  }
  return dynamo;
}

/** Async store. Memory locally; DynamoDB when AISLE_TABLE is set (Lambda / AWS). */
export const repo: StoreRepo = {
  listStores: async () => (await backend()).listStores(),
  getStore: async (slug) => (await backend()).getStore(slug),
  putStore: async (store) => (await backend()).putStore(store),
  listOrders: async (slug) => (await backend()).listOrders(slug),
  getOrder: async (id) => (await backend()).getOrder(id),
  putOrder: async (order) => (await backend()).putOrder(order),
  getMandate: async (id) => (await backend()).getMandate(id),
  putMandate: async (m) => (await backend()).putMandate(m),
  burnMandate: async (id) => (await backend()).burnMandate(id),
};
