import type { Metadata } from "next";

export function buildPageMetadata(title: string): Metadata {
  return {
    title: `${title} - Sendwise`,
  };
}
