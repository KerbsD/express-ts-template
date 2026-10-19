import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { bookings } from "../../db/schema.ts";
import type { ListBookingsQuery } from "../../validators/bookings.ts";

const handleListBookings = async (_req: Request, res: Response) => {
  // Placed here by validateListBookingsQuery (req.query is read-only in Express 5)
  const { status, from, to, search, limit, offset, sort, order } =
    res.locals.query as ListBookingsQuery;

  const filters: SQL[] = [];
  if (status) filters.push(eq(bookings.status, status));
  // from/to match when ANY of the preferred dates falls in the range
  if (from)
    filters.push(
      sql`EXISTS (SELECT 1 FROM unnest(${bookings.scheduledAt}) AS slot WHERE slot >= ${from})`,
    );
  if (to)
    filters.push(
      sql`EXISTS (SELECT 1 FROM unnest(${bookings.scheduledAt}) AS slot WHERE slot <= ${to})`,
    );
  if (search) {
    // Escape wildcards so the search term matches literally
    const term = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const match = or(ilike(bookings.name, term), ilike(bookings.email, term));
    if (match) filters.push(match);
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const sortColumn =
    sort === "scheduledAt" ? bookings.scheduledAt : bookings.createdAt;

  const [rows, [count]] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(where)
      .orderBy(order === "asc" ? asc(sortColumn) : desc(sortColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(bookings)
      .where(where),
  ]);

  res.json({
    success: true,
    data: rows,
    pagination: {
      limit,
      offset,
      total: count.total,
      hasMore: offset + rows.length < count.total,
    },
  });
};

export { handleListBookings };
