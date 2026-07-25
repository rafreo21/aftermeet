import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer discovery workspace — AfterMeet",
  description: "Internal evidence workspace for testing AfterMeet's customer, problem, and outcome hypotheses.",
};

export default function DiscoveryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
