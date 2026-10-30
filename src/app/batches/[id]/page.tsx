import { Suspense } from "react";
import type { Metadata } from "next";
import { BatchScreen } from "@/features/processing/batch-screen";

export const metadata: Metadata = { title: "Organizing photos · CareerLens" };

export default function BatchPage({ params }: PageProps<"/batches/[id]">) {
  return (
    <Suspense fallback={null}>
      <BatchPageInner params={params} />
    </Suspense>
  );
}

async function BatchPageInner({ params }: { params: PageProps<"/batches/[id]">["params"] }) {
  const { id } = await params;
  return <BatchScreen batchId={id} />;
}
