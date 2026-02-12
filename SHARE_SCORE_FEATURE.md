# Share Score Feature Documentation

## Overview

Players can now share their scores with friends via text message, social media, or any sharing method available on their device. The feature includes a download link to encourage viral growth.

## Features

### 📤 Share Score Button
- Prominently displayed on the Game Over screen
- Purple/violet gradient button with icon
- Located between leaderboard and play again buttons

### 📱 Native Share Dialog
- Uses React Native's native Share API
- Opens device's share sheet with multiple options:
  - **SMS/iMessage** - Direct text to friends
  - **WhatsApp** - Share to contacts or groups
  - **Facebook/Twitter** - Post to social media
  - **Email** - Send via email
  - **Copy to Clipboard** - Manual sharing
  - Any other sharing apps installed on device

### 🎮 Personalized Messages

**Regular Score Share:**
```
🎮 [Username] just scored [X] points and survived for [Y] seconds in Crossy Politician!

Think you can beat that? 🏆

Download now: [link]
```

**High Score Achievement:**
```
🏆 NEW HIGH SCORE! 🏆

[Username] just set a new record in Crossy Politician:
[X] points (+[improvement] from previous best!)

Can you beat it? Download now:
[link]
```

### ✅ Success Notifications
- Toast notification appears after sharing
- Success: Green toast with checkmark
- Error: Red toast with X icon
- Auto-dismisses after 3 seconds
- Smooth slide-in animation

## Implementation Details

### Files Created

#### 1. **utils/shareScore.ts**
Core sharing functionality:
- `shareScore(score, username, survivalTime)` - Share regular score
- `shareHighScore(score, previousBest, username)` - Share new high score
- `shareCustomMessage(message, includeLink)` - Custom message sharing
- `generateShareText(score, username, survivalTime)` - Generate copyable text
- `getDownloadLink()` - Platform-specific download links

#### 2. **components/Toast.tsx**
Notification system:
- Animated toast notifications
- Slide-in from top
- Auto-dismiss after configurable duration
- Success/Error/Info types with color coding
- Icon support (✓, ✗, ⓘ)

### Download Links

The share message includes platform-specific download links:

**iOS:** App Store link (when published)
```
https://apps.apple.com/app/crossy-politician
```

**Android:** Google Play Store link (when published)
```
https://play.google.com/store/apps/details?id=com.crossypolitician
```

**Fallback:** Generic website link
```
https://crossypolitician.com/download
```

### User Experience Flow

1. **Player finishes game** → Game Over screen appears
2. **Clicks "📤 Share Score with Friends"** button
3. **Native share dialog opens** with pre-filled message
4. **Player selects sharing method** (SMS, WhatsApp, etc.)
5. **Shares to recipient**
6. **Toast notification** confirms success
7. **Recipient receives message** with score and download link
8. **Recipient clicks link** → Downloads game

### Message Customization

The message automatically adjusts based on:
- **Username presence** - "I" vs "[Username]"
- **Survival time** - Included if available
- **High score status** - Different message format
- **Platform** - iOS includes URL separately

## Configuration

### Update Download Links

Edit the constants in `utils/shareScore.ts`:

```typescript
const GAME_DOWNLOAD_LINK = 'https://crossypolitician.com/download';
const APP_STORE_LINK = 'https://apps.apple.com/app/crossy-politician';
const PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.crossypolitician';
```

### Customize Share Message

Edit message templates in `shareScore()` and `shareHighScore()` functions.

### Toast Duration

Adjust toast display time:
```typescript
<Toast
  message={toastMessage}
  type={toastType}
  duration={3000} // milliseconds
  onHide={() => setToastVisible(false)}
/>
```

## Usage Examples

### Basic Share (After Game Over)
1. User scores 25 points
2. Clicks share button
3. Selects "Messages"
4. Message auto-populates: "🎮 I just scored 25 points..."
5. Sends to friend
6. Success toast appears

### High Score Share
1. User beats previous best (50 → 75 points)
2. Clicks share button
3. Message includes: "🏆 NEW HIGH SCORE! ... 75 points (+25 from previous best!)"
4. Shares to social media
5. Success toast confirms

### Share Dismissal
1. User opens share dialog
2. Presses cancel/back
3. No toast appears (dismissed gracefully)

## Platform Differences

### iOS
- URL parameter separated from message
- Native iOS share sheet appearance
- Can share to AirDrop, iMessage, etc.

### Android
- URL included in message text
- Android share sheet appearance
- Can share to nearby devices, Gmail, etc.

## Analytics Potential

Future enhancement opportunities:
- Track share button clicks
- Count successful shares
- Measure viral coefficient
- Track download conversions from shares

## Viral Growth Strategy

The share feature is designed to drive growth:

1. **Low Friction** - One tap to share
2. **Competitive Messaging** - "Think you can beat that?"
3. **Direct Download Link** - Easy for recipient to install
4. **Social Proof** - Shows specific scores
5. **High Score Celebration** - Encourages sharing achievements

## Troubleshooting

### Share button not working
- Check that Share API is available (should work on all modern devices)
- Verify in console for error messages
- Test on physical device (may not work in simulator)

### Wrong download link
- Update constants in `shareScore.ts`
- Ensure URLs are published and accessible

### Toast not appearing
- Check that `toastVisible` state is being set
- Verify Toast component is rendered
- Check z-index conflicts

### Message not customizing
- Verify username is being passed correctly
- Check that username state is populated
- Review shareScore/shareHighScore function calls

## Best Practices

1. **Test on Real Devices** - Share API works differently on real hardware
2. **Keep Messages Short** - Some platforms have character limits
3. **Include Emojis** - Makes messages more engaging
4. **Update Links Before Launch** - Ensure download links work
5. **Test All Share Methods** - SMS, WhatsApp, social media, etc.

## Future Enhancements

Potential improvements:
- Share with screenshot of score
- Custom share images/cards
- Deep links to specific challenges
- Share to specific platforms with custom formatting
- Share streaks/achievements
- Leaderboard position sharing
- Challenge friends directly
- Pre-filled recipient selection
