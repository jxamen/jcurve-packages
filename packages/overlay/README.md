# @jcurve/overlay

Floating overlay module for displaying shopping mission cards above other applications.

## Overview

This module enables shopping mission cards to be displayed above other apps on Android, allowing users to see product information (image, name, price, countdown) while using shopping apps or other applications.

## Features

- Display floating product card above other apps (Android only)
- Permission management (SYSTEM_ALERT_WINDOW)
- Image loading with fallback to empty state
- Customizable duration with auto-dismiss
- Drag to reposition card (Android native)
- Automatic cleanup on app background/termination

## Installation

```bash
npm install @jcurve/overlay
# or
yarn add @jcurve/overlay
```

## Usage

### Basic Usage

```typescript
import { isAvailable, hasPermission, requestPermission, show, hide } from '@jcurve/overlay';

// Check if overlay feature is available (Android only)
if (isAvailable()) {
  // Check current permission status
  if (!hasPermission()) {
    // Request permission from user
    requestPermission();
  } else {
    // Show floating card
    const success = await show({
      imageUrl: 'https://example.com/product.jpg',
      name: 'Product Name',
      price: '₩10,000',
      durationSec: 5,
    });
    
    if (success) {
      // Card is displayed
      // It will auto-dismiss after 5 seconds
    }
  }
}
```

### With ShoppingMission Component

The `@jcurve/mission` package automatically integrates with this overlay module when available:

```tsx
import { ShoppingMission } from '@jcurve/mission';
import { hasPermission } from '@jcurve/overlay';

<ShoppingMission
  fetchJson={fetchJson}
  onClose={onClose}
  safeAreaInsets={insets}
  overlayReady={hasPermission()}
  onOverlayRequest={() => requestPermission()}
  onFloatingPopup={(params) => show(params)}
/>
```

## API

### `isAvailable(): boolean`

Returns `true` if the overlay module is available on the current platform (Android/iOS).

### `hasPermission(): boolean`

Returns `true` if SYSTEM_ALERT_WINDOW permission is granted. Always returns `false` on iOS.

### `requestPermission(): void`

Opens system settings dialog to request SYSTEM_ALERT_WINDOW permission. No-op on iOS.

### `show(params: FloatingPopupParams): Promise<boolean>`

Displays a floating card above other apps.

**Parameters:**
- `imageUrl` (string): URL to product image
- `name` (string): Product name
- `price` (string): Product price
- `durationSec` (number): Duration before auto-dismiss (default 300s)

**Returns:** Promise that resolves to `true` if card displayed successfully, `false` otherwise.

### `hide(): void`

Hides the currently displayed floating card.

## Configuration

### EAS Build

Add the plugin to `app.json`:

```json
{
  "plugins": [
    "@jcurve/overlay"
  ]
}
```

The plugin automatically adds `android.permission.SYSTEM_ALERT_WINDOW` to AndroidManifest.xml.

## Google Play Permissions

**Korean Version:**
```
쇼핑 미션 중 다른 앱(쇼핑 앱) 위에 미션 안내 카드를 띄워 미션 진행 상품명·가격·남은 시간을 보여 주기 위해 SYSTEM_ALERT_WINDOW를 사용합니다. 사용자가 미션 페이지의 [권한 허용]을 눌렀을 때만 요청하며, 미션 안내 외 용도 없음.
```

**English Version:**
```
The SYSTEM_ALERT_WINDOW permission is used to display a shopping mission guide card above other apps (shopping applications) to show users the product name, price, and remaining time while they are completing the shopping mission. Permission is requested only when the user taps [Allow Permission] on the mission page, and is used solely for mission guidance.
```

## Platform-Specific Notes

### Android

- Requires API 21+
- Uses `TYPE_APPLICATION_OVERLAY` (API 26+) or `TYPE_PHONE` (below API 26)
- Card appears at top-left by default
- Draggable via native touch handling
- Requires explicit permission grant from user

### iOS

Not supported. All functions are no-ops on iOS:
- `hasPermission()` returns `false`
- `requestPermission()` does nothing
- `show()` returns `false`
- `hide()` does nothing

Integration with `@jcurve/mission` handles this gracefully by not showing overlay UI on iOS.

## Testing

```bash
npm run test
```

Tests verify safe no-op behavior when module is not available.

## License

UNLICENSED
