"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function EntityLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("font-medium hover:underline", className)}>
      {children}
    </Link>
  );
}
