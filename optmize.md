## Goal

Make the backend and database lighter on CPU/RAM, remove Prisma, and switch to mysql2 without data loss. Keep behavior stable while reducing runtime footprint.

---

## Migration plan (no data loss)

1. **Freeze schema changes**
   - Stop creating new Prisma migrations.
   - Keep the current DB schema as the source of truth.

2. **Backup before any change**
   - Take a full MySQL dump (schema + data).
   - Store a verified copy off-host.

3. **Remove Prisma runtime, keep schema**
   - Stop using Prisma Client in runtime code.
   - Keep the DB tables as-is.

4. **Introduce mysql2 with minimal wrapper**
   - Use mysql2/promise.
   - Add a small `db` module that provides a pool and typed query helpers.

5. **Replace Prisma calls module-by-module**
   - Start with auth + user flows (highest impact).
   - Then menu/blog/admin endpoints.
   - Keep endpoints and payloads identical to avoid frontend changes.

6. **Validation + rollback**
   - Test each route after migration.
   - Keep backups and a branch with Prisma for quick rollback.

---

## Backend optimizations (app)

- **Connection pooling**
  - Use a single `mysql2` pool, set sane defaults (e.g., connectionLimit 5-10).
- **Disable expensive middlewares**
  - Remove unused body parsers and heavy logging in prod.
  - Use a lightweight logger only if needed (or disable in prod).
- **Reduce memory usage**
  - Avoid caching large arrays in memory (menu/blog lists).
  - Stream files or use direct uploads instead of buffering.
- **Limit payload size**
  - Set JSON body limit to the smallest practical value.
- **Compression**
  - Enable gzip for responses if not already done (small CPU cost, big bandwidth gain).
- **Static assets**
  - Serve SPA assets with long cache headers.
  - Pre-compress assets (gzip/brotli) if your server supports it.
- **Remove unused packages**
  - Audit `package.json` and remove unused deps (especially heavy ones).
- **Optimize auth refresh**
  - Keep token refresh endpoints lightweight.
  - Avoid DB joins for refresh if possible.
- **Avoid N+1 queries**
  - Replace multiple queries with joins or `IN (...)`.

---

## Database optimizations (MySQL)

- **Indexing**
  - Add indexes on common filters:
    - `users.email`, `users.role`
    - `menu.category_id`, `menu.status`, `menu.is_featured`
    - `blog.status`, `blog.created_at`
    - `orders.user_id`, `orders.status`, `orders.created_at`
- **Limit row scans**
  - Always paginate on list endpoints.
  - Use `SELECT columns` instead of `SELECT *`.
- **Use the smallest data types**
  - Use `TINYINT` for booleans, `VARCHAR` only as needed.
- **Avoid heavy joins**
  - Precompute fields if the joins are too heavy.
- **Clean up unused rows**
  - Soft-delete only if required; otherwise hard delete for smaller tables.
- **Use proper collation**
  - Keep consistent collation and charset to avoid CPU-heavy conversions.

---

## Prisma removal checklist

- Remove Prisma Client usage from code paths.
- Remove Prisma migration commands from scripts.
- Remove Prisma package from dependencies once all routes are migrated.
- Keep `schema.prisma` only as a reference (optional).

---

## mysql2 setup guidance (minimal)

- Use `mysql2/promise`.
- Create a `db.ts` that exports `pool` and a small `query<T>()` helper.
- Use prepared statements for all user inputs.
- Avoid per-request connections; always use the pool.

---

## Safety checks (before/after)

- Compare row counts per table before and after migration.
- Verify auth, admin CRUD, and uploads.
- Load test key endpoints with low concurrency.

---

## Optional extra savings

- Run Node in production with `--max-old-space-size=256` (or lower if stable).
- Disable source maps in production builds.
- Reduce logging verbosity.
- Use a process manager with minimal overhead.
