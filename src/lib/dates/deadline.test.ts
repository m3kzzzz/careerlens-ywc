import { describe, expect, it } from "vitest";
import { daysUntil, deadlineLabel, deadlineUrgency, formatShortDate } from "./deadline";

const today = new Date(2026, 9, 29); // local 29 Oct 2026

describe("deadline helpers", () => {
  it("counts calendar days", () => {
    expect(daysUntil("2026-10-29", today)).toBe(0);
    expect(daysUntil("2026-11-01", today)).toBe(3);
    expect(daysUntil("2026-10-15", today)).toBe(-14);
  });

  it("matches the design system's urgency bands", () => {
    expect(deadlineUrgency("2026-11-01", today)).toBe("critical");
    expect(deadlineUrgency("2026-11-05", today)).toBe("soon");
    expect(deadlineUrgency("2026-12-20", today)).toBe("later");
    expect(deadlineUrgency("2026-10-15", today)).toBe("past");
  });

  it("formats labels", () => {
    expect(formatShortDate("2026-12-20", today)).toBe("20 Dec");
    expect(formatShortDate("2027-01-15", today)).toBe("15 Jan 2027");
    expect(deadlineLabel("2026-11-02", today)).toBe("Closes 2 Nov · 4 days left");
    expect(deadlineLabel("2026-12-20", today)).toBe("Closes 20 Dec");
    expect(deadlineLabel("2026-10-15", today)).toBe("Closed 15 Oct");
  });
});
