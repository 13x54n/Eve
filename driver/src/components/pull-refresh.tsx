import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Brand } from '@/constants/theme';

export function usePullToRefresh(reload: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  return { refreshing, onRefresh };
}

export function PullRefresh({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={Brand.accent}
      colors={[Brand.accent]}
    />
  );
}
