# User Authentication System Documentation

## Overview

MTC Stations uses a **Firebase-first authentication architecture** where Firebase handles phone OTP authentication while Supabase stores enriched user profile data. This hybrid approach leverages Firebase's robust phone auth with Supabase's PostgreSQL database for extensible user data.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT SIDE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌───────────────────┐    ┌──────────────────────┐ │
│  │ SignInModal  │───▶│ firebase-auth.ts  │───▶│ Firebase Phone Auth  │ │
│  │ (3-step UI)  │    │ sendOtp()         │    │ + reCAPTCHA          │ │
│  └──────────────┘    │ verifyOtpAndSync()│    └──────────────────────┘ │
│                      └───────────────────┘                              │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    FirebaseAuthProvider                           │  │
│  │  - Listens to onAuthStateChanged()                               │  │
│  │  - Dispatches setAuthUser() to Redux                             │  │
│  │  - Fetches profile via /api/auth/firebase-profile                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Redux (userSlice)                            │  │
│  │  State: user, profile, session, isSignedIn, isAdmin, loading     │  │
│  │  Actions: setAuthUser, setProfile, signOutUser, openSignInModal  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SERVER SIDE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────┐    ┌─────────────────────────────────────┐│
│  │ /api/auth/sync-profile  │───▶│  Supabase (firebase_profiles table) ││
│  │ POST - Upsert profile   │    │  - firebase_uid                     ││
│  └─────────────────────────┘    │  - phone, email, display_name       ││
│                                  │  - is_admin, roles                  ││
│  ┌─────────────────────────┐    │  - preferences (JSONB)              ││
│  │/api/auth/firebase-profile│───▶│  - timestamps                       ││
│  │ GET - Fetch profile     │    └─────────────────────────────────────┘│
│  └─────────────────────────┘                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/firebase-auth.ts` | Firebase initialization, OTP send/verify, auth state listener |
| `lib/supabase.ts` | Supabase client factory (browser, server, service role) |
| `store/userSlice.ts` | Redux slice for auth state management |
| `components/auth/FirebaseAuthProvider.tsx` | React context provider for auth |
| `components/auth/SignInModal.tsx` | 3-step sign-in modal UI |
| `components/auth/PhoneInput.tsx` | Phone number input with country selector |
| `components/auth/PinInput.tsx` | 6-digit OTP input component |
| `app/api/auth/sync-profile/route.ts` | Server endpoint to sync Firebase user to Supabase |
| `app/api/auth/firebase-profile/route.ts` | Server endpoint to fetch user profile |

---

## Authentication Flow

### Sign-In Process

```
1. User clicks "Sign In" button
   └─▶ dispatch(openSignInModal())

2. SignInModal renders (Welcome step)
   └─▶ User clicks "Continue with Phone"

3. Phone Entry step
   └─▶ User selects country (+852 HK default)
   └─▶ User enters phone number
   └─▶ Clicks "Send Code"

4. sendOtp() in firebase-auth.ts
   └─▶ Creates invisible reCAPTCHA verifier
   └─▶ Calls Firebase signInWithPhoneNumber()
   └─▶ Stores ConfirmationResult in module state

5. Verify step
   └─▶ User enters 6-digit OTP
   └─▶ Auto-submits on 6th digit

6. verifyOtpAndSync() in firebase-auth.ts
   └─▶ Confirms OTP with Firebase
   └─▶ Gets Firebase ID token
   └─▶ POST /api/auth/sync-profile (non-blocking)
   └─▶ Returns AuthUser object

7. Firebase auth state changes
   └─▶ FirebaseAuthProvider.onAuthStateChanged() fires
   └─▶ dispatch(setAuthUser(user))

8. Profile fetch
   └─▶ GET /api/auth/firebase-profile?uid=xxx
   └─▶ dispatch(setProfile(profile))

9. Modal closes, user is signed in
```

### Sign-Out Process

```
1. User clicks "Sign Out" in AppMenu
   └─▶ dispatch(signOutUser())

2. signOutUser thunk
   └─▶ Calls signOut() in firebase-auth.ts
   └─▶ Firebase signs out user

3. Firebase auth state changes
   └─▶ onAuthStateChanged() fires with null user
   └─▶ dispatch(setAuthUser(null))
   └─▶ dispatch(resetUserState())
```

---

## Data Storage

### Firebase (Authentication Only)

Firebase stores minimal auth data:

```typescript
// Firebase User object
{
  uid: string;              // Unique identifier
  phoneNumber: string;      // E.164 format (+85291234567)
  email?: string;           // Optional
  displayName?: string;     // Optional
  // JWT token contains custom claims:
  role?: string;            // User role
  admin?: boolean;          // Admin flag
}
```

### Supabase (Profile Data)

The `firebase_profiles` table stores enriched user data:

```sql
CREATE TABLE firebase_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,    -- Links to Firebase UID
  phone TEXT,                            -- Phone number
  email TEXT,                            -- Email address
  display_name TEXT,                     -- User's display name
  avatar_url TEXT,                       -- Profile picture URL
  roles TEXT[] DEFAULT '{}',             -- Array of role strings
  is_admin BOOLEAN DEFAULT FALSE,        -- Admin flag
  is_active BOOLEAN DEFAULT TRUE,        -- Account active status
  preferences JSONB DEFAULT '{}',        -- User preferences (JSON)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ           -- Last login timestamp
);
```

### Redux (In-Memory State)

```typescript
interface UserState {
  user: AuthUser | null;        // Firebase user data
  profile: UserProfile | null;  // Supabase profile data
  session: Session | null;      // Supabase session (if needed)
  isSignedIn: boolean;          // Derived from user presence
  isAdmin: boolean;             // From profile.is_admin
  loading: boolean;             // Auth operation in progress
  profileLoading: boolean;      // Profile fetch in progress
  error: string | null;         // Last error message
  showSignInModal: boolean;     // UI state for modal
}
```

---

## Redux Integration

### State Shape

```typescript
// store/userSlice.ts
const initialState: UserState = {
  user: null,
  profile: null,
  session: null,
  isSignedIn: false,
  isAdmin: false,
  loading: true,
  profileLoading: false,
  error: null,
  showSignInModal: false,
};
```

### Actions

| Action | Description |
|--------|-------------|
| `setAuthUser(user)` | Set Firebase user from auth state change |
| `setProfile(profile)` | Set Supabase profile data |
| `setSession(session)` | Set Supabase session |
| `resetUserState()` | Clear all auth state on sign-out |
| `openSignInModal()` | Show sign-in modal |
| `closeSignInModal()` | Hide sign-in modal |

### Async Thunks

| Thunk | Description |
|-------|-------------|
| `fetchUserProfile(userId)` | Fetch profile from Supabase |
| `updateUserProfile(updates)` | Update user's profile |
| `signOutUser()` | Sign out via Firebase |

### Selectors

```typescript
// Usage in components
const user = useAppSelector(selectUser);
const profile = useAppSelector(selectProfile);
const isSignedIn = useAppSelector(selectIsSignedIn);
const isAdmin = useAppSelector(selectIsAdmin);
const loading = useAppSelector(selectUserLoading);
const displayName = useAppSelector(selectDisplayName);
const userPhone = useAppSelector(selectUserPhone);
```

---

## Firebase Configuration

### Environment Variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Firebase Console Setup Required

1. **Enable Phone Authentication** in Firebase Console > Authentication > Sign-in method
2. **Add authorized domains** for reCAPTCHA (localhost, production domain)
3. **Configure reCAPTCHA** (invisible mode is used)

---

## Supabase Configuration

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-side only
```

### Client Types

```typescript
// lib/supabase.ts

// Browser client (for client components)
const supabase = getBrowserSupabaseClient();

// Server client with service role (bypasses RLS)
const supabase = getServerSupabaseClient('service');

// Server client with anon key (respects RLS)
const supabase = getServerSupabaseClient('anon');
```

---

## API Endpoints

### POST /api/auth/sync-profile

Syncs Firebase user to Supabase after OTP verification.

**Request:**
```
Authorization: Bearer <firebase-id-token>
```

**Response:**
```json
{
  "success": true,
  "profile": { ... }
}
```

### GET /api/auth/firebase-profile

Fetches user profile by Firebase UID.

**Request:**
```
GET /api/auth/firebase-profile?uid=firebase-uid-here
```

**Response:**
```json
{
  "id": "uuid",
  "firebase_uid": "xxx",
  "phone": "+85291234567",
  "display_name": "John",
  "is_admin": false,
  "roles": [],
  "preferences": {}
}
```

---

## Component Hierarchy

```
app/layout.tsx
└── ReduxProvider
    └── ThemeProvider
        └── FirebaseAuthProvider
            ├── SignInModal (portal)
            └── {children}
                └── AppMenu
                    ├── User profile display
                    └── Sign Out button
```

---

## Security Considerations

1. **Firebase ID Tokens**: Short-lived JWTs that expire after 1 hour
2. **Service Role**: Only used server-side for profile sync (never exposed to client)
3. **RLS Policies**: Supabase tables should have RLS enabled for direct client access
4. **reCAPTCHA**: Invisible reCAPTCHA protects against automated OTP requests
5. **Phone Verification**: Firebase handles rate limiting and fraud detection

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Firebase for auth | Robust phone OTP, reCAPTCHA, rate limiting out of the box |
| Supabase for profiles | PostgreSQL flexibility, JSONB preferences, easy extensibility |
| Non-blocking sync | Profile sync failures don't prevent sign-in |
| Redux for state | App-wide access to auth state, predictable updates |
| No session persistence | Auth state managed by Firebase/Supabase sessions |
| Service role for sync | Bypasses RLS for server-side profile upserts |

---

## Extending the System

### Adding New Profile Fields

1. Add column to `firebase_profiles` table in Supabase
2. Update `UserProfile` interface in `lib/supabase.ts`
3. Update sync endpoint to populate new field
4. Add selector in `userSlice.ts` if needed

### Adding Social Login

1. Enable provider in Firebase Console
2. Add sign-in button to SignInModal
3. Create new auth function in `firebase-auth.ts`
4. Profile sync will work automatically via existing endpoint

### Adding Role-Based Access

1. Set custom claims in Firebase (via Admin SDK)
2. Claims appear in `AuthUser.role` and `AuthUser.isAdmin`
3. Use `selectIsAdmin` selector for admin-only features
4. Add middleware for protected API routes
