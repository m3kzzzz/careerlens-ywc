import type { Metadata } from "next";
import { CompaniesScreen } from "@/features/companies/companies-screen";

export const metadata: Metadata = { title: "Your companies · CareerLens" };

export default function CompaniesPage() {
  return <CompaniesScreen />;
}
