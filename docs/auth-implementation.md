# Authentication System Documentation

> Last updated: 2025-11-28

## Overview

MTC Stations uses a **Firebase-first authentication** architecture where Firebase handles all authentication (phone OTP), and Supabase is used purely for data storage via service-role API routes.

This approach was chosen to match the existing [mtc-app](../../../mtc-app) authentication pattern, enabling potential user data sharing between applications.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────────┐   │
│  │ SignInModal │───>│ Firebase Phone   │───>│ FirebaseAuthProvider    │   │
│  │             │    │ Auth (OTP)       │    │ (onIdTokenChanged)      │   │
│  └─────────────┘    └──────────────────┘    └───────────┬─────────────┘   │
│                                                         │                   │
│                                                         ▼                   │
│                                              ┌─────────────────────┐        │
│                                              │ Redux Store         │        │
│                                              │ (userSlice)         │        │
│                                              └─────────────────────┘        │
│                                                         │                   │
└─────────────────────────────────────────────────────────┼───────────────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVER (API Routes)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────┐    ┌────────────────────────┐                  │
│  │ /api/auth/sync-profile │    │ /api/auth/firebase-    │                  │
│  │ POST - Create/update   │    │ profile                │                  │
│  │ profile on sign-in     │    │ GET - Fetch profile    │                  │
│  └───────────┬────────────┘    └───────────┬────────────┘                  │
│              │                              │                               │
│              └──────────────┬───────────────┘                               │
│                             ▼                                               │
│                  ┌─────────────────────┐                                    │
│                  │ Supabase            │                                    │
│                  │ (service role)      │                                    │
│                  │ firebase_profiles   │                                    │
│                  └─────────────────────┘                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Firebase Auth Module (`lib/firebase-auth.ts`)

Core authentication module providing:

| Function | Purpose |
|----------|---------|
| `sendOtp(phoneNumber, containerId)` | Send OTP via Firebase Phone Auth |
| `verifyOtpAndSync(code)` | Verify OTP and sync profile to Supabase |
| `signOut()` | Sign out from Firebase |
| `onAuthStateChanged(callback)` | Subscribe to auth state changes |
| `getCurrentIdToken()` | Get Firebase ID token for API calls |
| `getFirebaseAuth()` | Get Firebase Auth instance |

### 2. Auth Provider (`components/auth/FirebaseAuthProvider.tsx`)

React context provider that:
- Listens to Firebase `onIdTokenChanged` events
- Updates Redux state when auth changes
- Fetches profile from Supabase via API
- Renders the SignInModal when triggered

### 3. Auth Hook (`hooks/useFirebaseAuth.ts`)

React hook for components needing auth state:

```tsx
const {
  user,           // Firebase user object
  isSignedIn,     // boolean
  isAdmin,        // boolean (from Firebase claims or profile)
  profile,        // FirebaseProfile from Supabase
  loading,        // boolean
  signOut,        // () => Promise<void>
  refreshProfile  // () => Promise<void>
} = useFirebaseAuth();
```

### 4. Redux State (`store/userSlice.ts`)

Global auth state management:

```typescript
interface UserState {
  user: AuthUser | null;      // Firebase user info
  profile: UserProfile | null; // Supabase profile
  isSignedIn: boolean;
  isAdmin: boolean;
  loading: boolean;
  showSignInModal: boolean;
}
```

Key actions:
- `setAuthUser(user)` - Set Firebase user
- `setProfile(profile)` - Set Supabase profile
- `openSignInModal()` - Show sign-in UI
- `closeSignInModal()` - Hide sign-in UI
- `signOutUser()` - Async thunk to sign out

## Database Schema

### `firebase_profiles` Table

```sql
CREATE TABLE public.firebase_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,  -- Firebase user UID
  phone TEXT,
  display_name TEXT,
  email TEXT,
  roles TEXT[] DEFAULT '{user}',
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);
```

## UI/UX Flow

### Sign-In Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        SIGN-IN FLOW                              │
└─────────────────────────────────────────────────────────────────┘

1. USER TRIGGERS SIGN-IN
   ├── Click "Sign In" button in AppMenu
   ├── Or programmatically via dispatch(openSignInModal())
   └── SignInModal opens (rendered via React Portal)

2. WELCOME STEP
   ┌─────────────────────────────────┐
   │  [Image: sign-in-1.png]        │
   │  ────────────────────────────  │
   │  Step Indicator: ● ○ ○         │
   │                                 │
   │  Sign In                        │
   │  Access your account            │
   │                                 │
   │  Sign in to save your favorite  │
   │  car parks, track availability  │
   │  history, and get personalized  │
   │  recommendations.               │
   │                                 │
   │  [    Continue    ]             │
   │                                 │
   │  By continuing, you agree to... │
   └─────────────────────────────────┘

3. PHONE ENTRY STEP
   ┌─────────────────────────────────┐
   │  Enter your phone               │
   │  We'll send you a verification  │
   │  code                           │
   │                                 │
   │  ┌─────────────────────────┐   │
   │  │ +852 │ 9876 5432       │   │
   │  └─────────────────────────┘   │
   │                                 │
   │  [    Send Code    ]            │
   │  [      Back       ]            │
   └─────────────────────────────────┘

   - Phone number validated (min 8 digits)
   - Firebase reCAPTCHA (invisible) triggered
   - OTP sent via Firebase Phone Auth

4. VERIFICATION STEP
   ┌─────────────────────────────────┐
   │  Verification                   │
   │  Enter the code sent to         │
   │  +852 9876 5432                 │
   │                                 │
   │  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐      │
   │  │1│ │2│ │3│ │4│ │5│ │6│      │
   │  └─┘ └─┘ └─┘ └─┘ └─┘ └─┘      │
   │                                 │
   │  Resend code in 30s             │
   │                                 │
   │  [     Verify      ]            │
   │  [ Change phone number ]        │
   └─────────────────────────────────┘

   - 6-digit PIN input with auto-focus
   - Auto-submit when 6 digits entered
   - 30s cooldown for resend

5. SUCCESS
   - Firebase auth completed
   - Profile synced to Supabase via API
   - Redux state updated
   - Modal closes
   - User sees signed-in state in AppMenu
```

### Signed-In State (AppMenu)

```
┌─────────────────────────────────┐
│  [Logo] MTC Stations      [X]  │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐   │
│  │ [Avatar]  John Doe     >│   │
│  │           +852 9876... │   │
│  └─────────────────────────┘   │
│                                 │
│  SETTINGS                       │
│  ┌─────────────────────────┐   │
│  │ Theme      [☀️] [🌙]    │   │
│  └─────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│  🚪 Sign Out                    │
│                                 │
│  Privacy  Terms        v1.0.0   │
└─────────────────────────────────┘
```

### Signed-Out State (AppMenu)

```
┌─────────────────────────────────┐
│  [Logo] MTC Stations      [X]  │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐   │
│  │      [ Sign In ]        │   │
│  └─────────────────────────┘   │
│                                 │
│  SETTINGS                       │
│  ┌─────────────────────────┐   │
│  │ Theme      [☀️] [🌙]    │   │
│  └─────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│  Privacy  Terms        v1.0.0   │
└─────────────────────────────────┘
```

### Sign-Out Flow

```
1. User clicks "Sign Out" in AppMenu
2. dispatch(signOutUser()) called
3. Firebase signOut() executed
4. onIdTokenChanged fires with null user
5. Redux state cleared (user, profile, session)
6. UI updates to signed-out state
```

## API Routes

### POST `/api/auth/sync-profile`

Creates or updates profile on sign-in.

**Request:**
```json
{
  "uid": "firebase-user-id",
  "phone": "+85298765432",
  "email": null,
  "displayName": "John Doe"
}
```

**Headers:**
```
Authorization: Bearer <firebase-id-token>
```

**Response:**
```json
{
  "profile": {
    "id": "uuid",
    "firebase_uid": "firebase-user-id",
    "phone": "+85298765432",
    ...
  }
}
```

### GET `/api/auth/firebase-profile?uid=xxx`

Fetches profile by Firebase UID.

**Headers:**
```
Authorization: Bearer <firebase-id-token>
```

**Response:**
```json
{
  "profile": {
    "id": "uuid",
    "firebase_uid": "xxx",
    ...
  }
}
```

## File Structure

```
lib/
├── firebase-auth.ts          # Firebase auth module (primary)
├── firebase.ts               # Legacy (can be removed)
└── supabase.ts               # Supabase client (data only)

hooks/
├── useFirebaseAuth.ts        # Firebase auth hook
└── useAuth.ts                # Legacy Supabase auth hook

components/auth/
├── index.ts                  # Exports
├── FirebaseAuthProvider.tsx  # Firebase auth provider (active)
├── AuthProvider.tsx          # Legacy Supabase provider
├── SignInModal.tsx           # Sign-in modal UI
├── PhoneInput.tsx            # Phone number input
├── PinInput.tsx              # OTP input
└── StepIndicator.tsx         # Progress dots

store/
└── userSlice.ts              # Redux auth state

app/api/auth/
├── sync-profile/route.ts     # Profile sync on sign-in
├── firebase-profile/route.ts # Fetch profile
└── profile/route.ts          # Legacy Supabase profile API
```

## Environment Variables

```env
# Firebase Client SDK (required)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# Optional: Disable reCAPTCHA for local dev
NEXT_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION=true
```

## Security Considerations

1. **Firebase ID Token Verification**: Currently, API routes trust tokens from the frontend. For production, implement proper Firebase Admin SDK verification.

2. **RLS Policies**: The `firebase_profiles` table uses a permissive policy. Consider restricting based on verified Firebase claims.

3. **Phone Number Validation**: Firebase handles phone format validation and rate limiting for OTP.

4. **reCAPTCHA**: Invisible reCAPTCHA is used to prevent abuse. Can be disabled for local development.

## Future Enhancements

- [ ] Add Firebase Admin SDK for server-side token verification
- [ ] Implement proper RLS policies based on Firebase UID
- [ ] Add profile editing UI
- [ ] Support additional auth methods (email, social)
- [ ] Add session persistence options
- [ ] Implement admin role management UI
