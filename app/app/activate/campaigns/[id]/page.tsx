import { redirect } from "next/navigation";

export default async function LegacyCampaignRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/business/activate/campaigns/${id}`);
}
