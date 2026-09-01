# Offline Resilience Implementation

This document outlines the comprehensive offline resilience features implemented for both the Rider and Driver apps in the Eve Expo React Native monorepo.

## Overview

The offline resilience system ensures that both apps can gracefully handle network connectivity issues, providing a seamless user experience even when internet connectivity is intermittent or unavailable.

## Features Implemented

### 1. Network Awareness (`NetworkContext`)

**Location:**
- `rider/src/context/network-context.tsx`
- `driver/src/context/network-context.tsx`

**Features:**
- Real-time network connectivity monitoring using `@react-native-community/netinfo`
- Tracks connection state (online/offline, connection type, internet reachability)
- Provides `useNetwork()` hook for components to access network state
- Automatic reconnection detection

**Usage:**
```typescript
import { useNetwork } from '@/context/network-context';

function MyComponent() {
  const { isOnline, isConnected, connectionType } = useNetwork();
  
  if (!isOnline) {
    return <Text>You're offline. Some features may be limited.</Text>;
  }
  // ...
}
```

### 2. Offline Storage (`OfflineStorage`)

**Location:**
- `rider/src/lib/offline-storage.ts`
- `driver/src/lib/offline-storage.ts`

**Features:**
- Type-safe wrapper around AsyncStorage
- Automatic JSON serialization/deserialization
- Error handling and logging
- App-specific storage keys to prevent conflicts

**Storage Keys:**

**Rider App:**
- `USER_PROFILE` - Cached user profile data
- `ACTIVE_TRIP` - Current active trip details
- `PENDING_ACTIONS` - Queued mutations
- `LAST_SYNC` - Last successful sync timestamp
- `CACHED_TRIPS` - Historical trip data

**Driver App:**
- `USER_PROFILE` - Cached user profile data
- `ACTIVE_TRIP` - Current active trip details
- `PENDING_ACTIONS` - Queued mutations
- `LOCATION_BUFFER` - Buffered GPS locations
- `LAST_SYNC` - Last successful sync timestamp
- `DRIVER_STATUS` - Last known driver status
- `CACHED_EARNINGS` - Cached earnings data

**Usage:**
```typescript
import { OfflineStorage } from '@/lib/offline-storage';

// Store data
await OfflineStorage.set('USER_PROFILE', userProfile);

// Retrieve data
const cachedProfile = await OfflineStorage.get<UserProfile>('USER_PROFILE');

// Remove data
await OfflineStorage.remove('ACTIVE_TRIP');
```

### 3. Action Queue System

**Location:**
- `rider/src/lib/action-queue.ts`
- `driver/src/lib/action-queue.ts`

**Features:**
- Queues critical mutations when offline
- Automatic retry with configurable attempts
- Action expiry to prevent stale operations
- Persistent queue across app restarts
- Automatic processing when network is restored

**Architecture:**
```typescript
// Register a handler
actionQueue.registerHandler('driver:startTrip', async (payload) => {
  const { tripId } = payload as { tripId: string };
  await startTrip(tripId);
});

// Queue an action
await actionQueue.enqueue('driver:startTrip', 
  { tripId: '123' },
  { maxRetries: 3, expiryMs: 300000 } // 5 minutes
);

// Process queue (automatically called when online)
await actionQueue.process(isOnline);
```

### 4. Trip Mutation Handlers

**Location:**
- `rider/src/services/trip-mutations.ts`
- `driver/src/services/trip-mutations.ts`

**Features:**

**Driver Actions:**
- `driver:acceptDispatch` - Accept incoming trip dispatch
- `driver:declineDispatch` - Decline trip dispatch
- `driver:arrivedAtPickup` - Mark arrival at pickup location
- `driver:startTrip` - Start the trip
- `driver:completeTrip` - Complete the trip with rating/feedback
- `driver:cancelTrip` - Cancel the trip

**Rider Actions:**
- `rider:cancelTrip` - Cancel trip request
- `rider:acceptOffer` - Accept driver offer

### 5. Driver Location Buffering

**Location:**
- `driver/src/services/location-buffer.ts`

**Features:**
- Buffers GPS locations when offline or socket disconnected
- Automatic flush when connection is restored
- Configurable buffer size (default: 100 locations)
- Location expiry (default: 5 minutes)
- Persistent buffer across app restarts

**Usage:**
```typescript
import { locationBuffer } from '@/services/location-buffer';

// Initialize on app start
await locationBuffer.initialize();

// Send location (automatically buffers if offline)
await locationBuffer.sendLocation(latitude, longitude, isOnline);

// Flush buffered locations when back online
const sentCount = await locationBuffer.flush(isOnline);
```

### 6. User Profile Caching

**Location:**
- `rider/src/context/auth-context.tsx`
- `driver/src/context/auth-context.tsx`

**Features:**
- Caches user profile to AsyncStorage after successful fetch
- Loads cached profile on app start
- Falls back to cached data when offline
- Refreshes from API when online
- Prevents forced logout on network errors

### 7. Active Trip Persistence

**Location:**
- `rider/src/context/ride-session.tsx`

**Features:**
- Persists active trip data to offline storage
- Restores trip on app restart
- Falls back to cached trip when offline
- Automatic reconciliation when back online

### 8. API Retry Logic

**Location:**
- `rider/src/services/api.ts`
- `driver/src/services/api.ts`

**Features:**
- Automatic retry on network failures
- Exponential backoff (1s, 2s, 4s)
- Configurable max retries (default: 3)
- Retries on specific status codes: 408, 429, 500, 502, 503, 504
- Retries on network errors (no response)

### 9. Socket Reconnection

**Location:**
- `rider/src/services/socket.ts`
- `driver/src/services/socket.ts`

**Features:**
- Automatic reconnection with exponential backoff
- Connection state tracking
- Maximum reconnection attempts (default: 5)
- Automatic trip subscription restoration on reconnect
- Better error logging and connection monitoring

### 10. Offline Banner UI

**Location:**
- `rider/src/components/offline-banner.tsx`
- `driver/src/components/offline-banner.tsx`

**Features:**
- Animated banner that slides in when offline
- Differentiates between "No Connection" and "No Internet"
- Auto-hides when back online
- Smooth transitions using Reanimated

**Integration:**
```typescript
import { OfflineBanner } from '@/components/offline-banner';

function MyScreen() {
  return (
    <View>
      <OfflineBanner />
      {/* Rest of your screen */}
    </View>
  );
}
```

## Testing Offline Scenarios

### Test Network Connectivity
1. Enable Airplane Mode on device
2. Verify offline banner appears
3. Attempt actions (they should queue)
4. Disable Airplane Mode
5. Verify queued actions execute automatically

### Test User Profile Caching
1. Launch app while online
2. Wait for profile to load
3. Enable Airplane Mode
4. Force quit and restart app
5. Verify cached profile loads

### Test Trip Persistence (Rider)
1. Start a trip while online
2. Enable Airplane Mode
3. Force quit app
4. Restart app offline
5. Verify trip still shows with cached data

### Test Location Buffering (Driver)
1. Start a trip while online
2. Enable Airplane Mode
3. Drive for a few minutes (locations buffer)
4. Disable Airplane Mode
5. Verify buffered locations are sent

### Test Action Queue
1. Navigate to trip screen
2. Enable Airplane Mode
3. Attempt to mark "Arrived" or "Start Trip"
4. Action should queue
5. Disable Airplane Mode
6. Verify action executes automatically

## Architecture Decisions

### Why AsyncStorage?
- Available on all platforms (iOS, Android, Web)
- Simple key-value interface
- Good performance for small datasets
- Officially supported by React Native community
- Follows security guidelines (non-sensitive data only)

### Why Not Store JWT in AsyncStorage?
- Security: JWTs remain in SecureStore (Keychain/Keystore) as per `SECURITY.md`
- Only cached non-sensitive data goes to AsyncStorage
- Follows principle of least privilege

### Queue Expiry Design
- Prevents executing stale operations (e.g., accepting an expired dispatch)
- Default 5-minute expiry for time-sensitive actions
- Can be configured per action type

### Location Buffer Size
- 100 locations = ~1.5 minutes at 1Hz GPS
- Balances storage space vs. data retention
- Older than 5 minutes are discarded (stale)

## Future Enhancements

### Potential Improvements
1. **Conflict Resolution**: Handle cases where cached and server state diverge
2. **Sync Status Indicator**: Show when data is syncing in the background
3. **Offline Maps**: Cache map tiles for offline viewing
4. **Smart Polling**: Reduce polling frequency when socket is connected
5. **Metrics**: Track offline events for monitoring
6. **Partial Updates**: Support incremental sync for large datasets

### Advanced Features
- **Differential Sync**: Only sync changed data
- **Background Sync**: Use background tasks for data sync
- **Optimistic UI**: Update UI immediately, sync in background
- **Conflict Resolution UI**: Let users choose when conflicts occur

## Dependencies

```json
{
  "@react-native-community/netinfo": "^11.x.x",
  "@react-native-async-storage/async-storage": "^2.x.x"
}
```

## Performance Considerations

1. **Storage Size**: AsyncStorage has platform-specific limits (~6MB on iOS)
2. **Read/Write Speed**: AsyncStorage is fast but not instant
3. **Memory Usage**: Location buffer kept in memory for fast access
4. **Network Calls**: Retry logic adds latency on failures
5. **Queue Processing**: Processes serially to maintain order

## Security Considerations

1. **No Sensitive Data in AsyncStorage**: Follows `SECURITY.md` guidelines
2. **JWT Isolation**: Access tokens stay in SecureStore only
3. **Action Validation**: Server validates all queued actions
4. **Expiry Times**: Prevent replay of stale actions
5. **User Isolation**: Storage keys are app-specific but not user-specific (single device = single user)

## Troubleshooting

### Actions Not Executing
- Check queue with `actionQueue.getQueue()`
- Verify handlers are registered
- Check expiry times
- Look for errors in console logs

### Profile Not Caching
- Verify network state detection
- Check AsyncStorage permissions
- Look for storage quota errors

### Location Buffer Not Working
- Verify buffer initialization
- Check socket connection state
- Ensure flush is called when online

### Socket Not Reconnecting
- Check MAX_RECONNECT_ATTEMPTS
- Verify token is valid
- Check WebSocket server availability

## Support

For questions or issues, refer to:
- `AGENTS.md` for Expo 57 specific notes
- `SECURITY.md` for security guidelines
- Project README for general setup

---

**Implementation Date**: September 2026  
**Expo Version**: 57.0.x  
**React Native Version**: 0.86.3
