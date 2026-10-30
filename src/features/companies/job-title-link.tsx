import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { JobLink } from "./company-model";

/** A position title: external JD (↗, new tab), internal position detail, or plain text. */
export function JobTitleLink({ title, link }: { title: string; link: JobLink }) {
  if (link.kind === "external") {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-hover hover:underline">
        {title}
        <ArrowUpRight size={12} strokeWidth={2.2} className="ml-1 inline align-[-1px]" aria-label="opens external site" />
      </a>
    );
  }
  if (link.kind === "internal") {
    return (
      <Link
        href={link.href}
        className="font-medium text-primary-hover underline decoration-primary-line underline-offset-[3px] hover:decoration-primary-hover"
      >
        {title}
      </Link>
    );
  }
  return <span className="font-medium text-ink">{title}</span>;
}
