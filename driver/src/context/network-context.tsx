import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import NetInfo, {
  type NetInfoState,
} from "@react-native-community/netinfo";

type NetworkContextValue = {
  isOnline: boolean;
  isConnected: boolean;
  connectionType: string | null;
  isInternetReachable: boolean | null;
  refresh: () => Promise<void>;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<
    boolean | null
  >(null);

  const handleConnectivityChange = useCallback((state: NetInfoState) => {
    setIsConnected(state.isConnected ?? false);
    setIsInternetReachable(state.isInternetReachable);
    setConnectionType(state.type);

    const online =
      state.isConnected === true &&
      (state.isInternetReachable === true || state.isInternetReachable === null);
    setIsOnline(online);
  }, []);

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    handleConnectivityChange(state);
  }, [handleConnectivityChange]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

    NetInfo.fetch().then(handleConnectivityChange);

    return () => {
      unsubscribe();
    };
  }, [handleConnectivityChange]);

  const value = useMemo<NetworkContextValue>(
    () => ({
      isOnline,
      isConnected,
      connectionType,
      isInternetReachable,
      refresh,
    }),
    [isOnline, isConnected, connectionType, isInternetReachable, refresh],
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetwork must be used within NetworkProvider");
  }

  return context;
}
