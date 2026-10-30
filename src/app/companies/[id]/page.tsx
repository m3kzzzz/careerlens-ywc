import { Suspense } from "react";
import type { Metadata } from "next";
import { CompanyDetailScreen } from "@/features/companies/company-detail";

export const metadata: Metadata = { title: "Company · CareerLens" };

export default function CompanyPage({ params }: PageProps<"/companies/[id]">) {
  return (
    <Suspense fallback={null}>
      <CompanyPageInner params={params} />
    </Suspense>
  );
}

async function CompanyPageInner({ params }: { params: PageProps<"/companies/[id]">["params"] }) {
  const { id } = await params;
  return <CompanyDetailScreen companyId={decodeURIComponent(id)} />;
}
