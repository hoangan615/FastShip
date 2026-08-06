import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";

import * as api from "@/api/endpoints";
import { EmptyState, Screen } from "@/components/ui";

export default function ActiveOrderScreen() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["shippers", "me"],
    queryFn: api.getMyShipperProfile,
    refetchInterval: 5_000,
  });

  if (isLoading) {
    return (
      <Screen center>
        <EmptyState icon="navigate-outline" title="Loading..." loading />
      </Screen>
    );
  }

  if (profile?.active_order_id) {
    return <Redirect href={`/order/${profile.active_order_id}` as never} />;
  }

  return (
    <Screen center>
      <EmptyState
        icon="bicycle-outline"
        title="No active order right now"
        subtitle="Go online from Home to start receiving offers."
      />
    </Screen>
  );
}
