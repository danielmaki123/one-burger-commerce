import { describe, expect, it } from "vitest";

import {
  buildOperationalOrderQueue,
  buildOperationalReservationQueue,
} from "./admin-operation-queues";

describe("admin operation queues", () => {
  it("keeps only open orders and puts intake work before later stages", () => {
    const queue = buildOperationalOrderQueue([
      { id: "ready", status: "ready", createdAt: "2026-07-22T09:00:00.000Z" },
      { id: "closed", status: "closed", createdAt: "2026-07-22T08:00:00.000Z" },
      { id: "new-later", status: "new", createdAt: "2026-07-22T10:00:00.000Z" },
      { id: "new-earlier", status: "new", createdAt: "2026-07-22T09:30:00.000Z" },
      { id: "preparing", status: "preparing", createdAt: "2026-07-22T08:30:00.000Z" },
    ]);

    expect(queue.map((order) => order.id)).toEqual([
      "new-earlier",
      "new-later",
      "preparing",
      "ready",
    ]);
  });

  it("keeps active reservations and shows requests before the schedule", () => {
    const queue = buildOperationalReservationQueue([
      { id: "approved-late", status: "approved", time: "19:30" },
      { id: "cancelled", status: "cancelled", time: "18:00" },
      { id: "requested-late", status: "requested", time: "20:00" },
      { id: "requested-early", status: "requested", time: "18:30" },
      { id: "approved-early", status: "approved", time: "18:00" },
    ]);

    expect(queue.map((reservation) => reservation.id)).toEqual([
      "requested-early",
      "requested-late",
      "approved-early",
      "approved-late",
    ]);
  });
});
