import { NativeTabs } from "expo-router/unstable-native-tabs";

export default function TabsLayout() {
  return (
    <NativeTabs backBehavior="history">
      <NativeTabs.Trigger name="home" disablePopToTop>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="earnings" disablePopToTop>
        <NativeTabs.Trigger.Icon sf={{ default: "creditcard", selected: "creditcard.fill" }} md="account_balance_wallet" />
        <NativeTabs.Trigger.Label>Earnings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="menu" disablePopToTop>
        <NativeTabs.Trigger.Icon sf={{ default: "line.3.horizontal", selected: "line.3.horizontal" }} md="menu" />
        <NativeTabs.Trigger.Label>Menu</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
