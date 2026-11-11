# NEXO+ Security Specification

## 1. Data Invariants
1. **Master Admin Governance**: Only verified master administrators (`nexodigitalposadas@gmail.com`, `blackstarproducciones.misiones@gmail.com`, or listed in `/admins/{uid}`) may create or deactivate stores or read all private `storeAccounts`.
2. **Store Ownership Gate**: Every `Category` and `Product` under `/stores/{storeId}` must reference an existing parent store, and its `ownerUid` must equal the parent store's `ownerUid`. Only that store owner or a master admin can mutate them.
3. **PII Isolation**: Owner login emails are isolated in `/storeAccounts/{storeId}` and never exposed in `/stores/{storeId}` public reads.
4. **Availability Enforcement**: Public shoppers can list/get categories and products only when `isAvailable == true`. Store owners and master admins can read all items regardless of `isAvailable`.
5. **Immutable Identity & Timestamps**: `id`, `storeId`, `ownerUid`, and `createdAt` are immutable after creation; `createdAt` and `updatedAt` must match `request.time`.

## 2. Dirty Dozen Attack Payloads (All Must Yield PERMISSION_DENIED)
1. **Self-Admin Escalation**: Non-admin user tries `create` on `/admins/{uid}` with `{ role: "master" }`.
2. **Unverified Admin Email Spoof**: User with unverified email token matching admin email tries to create a store.
3. **Unauthorized Store Creation**: Store owner tries `create` on `/stores/rogue-store` directly without Master Admin privileges.
4. **Shadow Field Injection on Store Update**: Store owner adds `ghostField: true` during `/stores/{storeId}` update.
5. **Owner Hijack on Store Update**: Store owner attempts to mutate `ownerUid` or `createdAt` on `/stores/{storeId}`.
6. **PII Leak Attempt**: Unauthenticated shopper or rival store owner attempts `get` on `/storeAccounts/{otherStoreId}`.
7. **Unscoped List on StoreAccounts**: Non-admin attempts blanket `list` on `/storeAccounts` without matching `ownerUid`.
8. **Orphan Category Creation**: Authenticated user tries to create a category under `/stores/non-existent/categories/c1`.
9. **Cross-Store Product Tampering**: Owner of Store A tries to create or update a product inside `/stores/storeB/products/p1`.
10. **Unavailable Item Scraping**: Public user tries to query `products` where `isAvailable == false`.
11. **ID Poisoning**: Attacker attempts write to `/stores/{1500-char-id}` or invalid regex characters (`../hack`).
12. **Negative/Invalid Price or Oversized String**: Owner submits `price: -10` or `name` > 120 chars on `/stores/{storeId}/products/p1`.
