import type { Metadata } from "next";
import { CalendarScreen } from "@/features/calendar/calendar-screen";

export const metadata: Metadata = { title: "My Calendar · CareerLens" };

export default function CalendarPage() {
  return <CalendarScreen />;
}
