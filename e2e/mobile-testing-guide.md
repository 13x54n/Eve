# Mobile E2E Testing Guide for Rider & Driver Apps

This guide covers E2E testing setup for the React Native apps (rider and driver).

## Recommended Tools

### Option 1: Maestro (Recommended for simplicity)

**Pros:**
- Simple YAML-based tests
- Works on iOS and Android
- Cloud testing support
- Fast to set up

**Setup:**
```bash
# Install Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# For Rider app
cd rider
maestro test flows/

# For Driver app  
cd driver
maestro test flows/
```

**Sample Maestro Flow** (`rider/e2e/login-flow.yaml`):
```yaml
appId: com.eve.rider
---
- launchApp
- tapOn: "Login"
- inputText: "test@example.com"
- tapOn: "Password"
- inputText: "TestPassword123"
- tapOn: "Sign In"
- assertVisible: "Home"
```

### Option 2: Detox

**Pros:**
- More powerful, programmatic tests
- Gray box testing (can access app internals)
- Jest-based

**Setup:**

1. Install Detox:
```bash
npm install --save-dev detox jest
```

2. Add Detox config to `package.json`:
```json
{
  "detox": {
    "test-runner": "jest",
    "configurations": {
      "ios.sim.debug": {
        "device": {
          "type": "iPhone 15"
        },
        "app": "ios.debug"
      },
      "android.emu.debug": {
        "device": {
          "avdName": "Pixel_5_API_33"
        },
        "app": "android.debug"
      }
    }
  }
}
```

3. Create test:
```typescript
// e2e/login.test.ts
describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should login successfully', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('TestPassword123');
    await element(by.id('login-button')).tap();
    await expect(element(by.id('home-screen'))).toBeVisible();
  });
});
```

## Recommended Test Scenarios

### Rider App Critical Paths

1. **Authentication Flow**
   - Sign up with Auth0
   - Login with Auth0
   - Logout

2. **Request Ride Flow**
   - Enter pickup location
   - Enter destination
   - See fare estimate
   - Request ride
   - View incoming offers
   - Accept offer
   - Track driver

3. **Trip Completion**
   - Complete trip
   - Rate driver
   - View receipt

### Driver App Critical Paths

1. **Onboarding**
   - Complete profile
   - Upload documents
   - Add vehicle

2. **Going Online**
   - Toggle online status
   - Receive trip notifications

3. **Trip Handling**
   - View incoming trip
   - Send offer
   - Navigate to pickup
   - Start trip
   - Complete trip
   - View earnings

## Mock Services for Testing

Create mock servers for testing without hitting real APIs:

```typescript
// test/mocks/api-mock.ts
import { setupServer } from 'msw/native';
import { rest } from 'msw';

export const server = setupServer(
  rest.post('http://localhost:4000/api/auth/login', (req, res, ctx) => {
    return res(
      ctx.json({
        token: 'mock-jwt-token',
        user: { id: 1, email: 'test@example.com' }
      })
    );
  }),
  
  rest.post('http://localhost:4000/api/rider/trips', (req, res, ctx) => {
    return res(
      ctx.json({
        trip: {
          id: 'trip-123',
          status: 'SEARCHING',
          suggestedFare: 15.50
        }
      })
    );
  })
);
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Mobile E2E Tests

on:
  pull_request:
    paths:
      - 'rider/**'
      - 'driver/**'

jobs:
  ios-e2e:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: cd rider && npm ci
      
      - name: Install Maestro
        run: curl -Ls "https://get.maestro.mobile.dev" | bash
      
      - name: Build iOS app
        run: cd rider && npx expo prebuild -p ios && xcodebuild -workspace ios/*.xcworkspace -scheme rider -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build
      
      - name: Run E2E tests
        run: maestro test rider/e2e/
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: maestro-results
          path: ~/.maestro/tests/

  android-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      
      - name: Set up JDK
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      
      - name: Install dependencies
        run: cd rider && npm ci
      
      - name: Install Maestro
        run: curl -Ls "https://get.maestro.mobile.dev" | bash
      
      - name: Build Android app
        run: cd rider && npx expo prebuild -p android && cd android && ./gradlew assembleDebug
      
      - name: Run E2E tests
        run: maestro test rider/e2e/
```

## Best Practices

1. **Use Test IDs**: Add `testID` prop to components for reliable selection
   ```typescript
   <Button testID="login-button" onPress={handleLogin}>Login</Button>
   ```

2. **Mock Location Services**: Use mock GPS coordinates for consistent tests
   ```typescript
   // In test setup
   await device.setLocation(40.7128, -74.0060); // NYC
   ```

3. **Handle Auth0**: Use test credentials or mock Auth0 responses
   ```typescript
   // Mock Auth0 in tests
   jest.mock('react-native-auth0', () => ({
     useAuth0: () => ({
       authorize: jest.fn(),
       user: mockUser,
     }),
   }));
   ```

4. **Test Offline Scenarios**: Verify app behavior without network
   ```typescript
   await device.setStatusBar({ networkStatus: 'offline' });
   ```

5. **Screenshot Testing**: Capture screenshots for visual regression
   ```typescript
   await device.takeScreenshot('home-screen');
   ```

## Next Steps

1. Choose testing framework (Maestro recommended)
2. Set up test environment
3. Write critical path tests
4. Integrate into CI/CD
5. Run regularly and maintain

## Resources

- [Maestro Documentation](https://maestro.mobile.dev/)
- [Detox Documentation](https://wix.github.io/Detox/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Expo Testing Guide](https://docs.expo.dev/develop/unit-testing/)
