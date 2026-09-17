# Settings Page Implementation Plan

## Goal

Build a responsive settings experience where an authenticated user can manage
their profile, learning goal, password, and account preferences without mixing
unrelated save operations.

This repository currently contains the NestJS backend. The backend contract is
implemented here first; the page itself should be built in the frontend
repository once it is available.

## MVP scope

### Profile

- Display avatar, username, email, level, EXP, streak, and email verification
  status.
- Edit username and email.
- Upload and save an avatar.
- Reset `isEmailVerified` only when the email address actually changes.

### Learning goal

- Display today's score, daily target, streak, and timezone.
- Select a preset target (50, 100, or 200 points) or enter a custom target.
- Allow targets from 10 through 20,000 points.
- Show a pending target and its effective date because target changes take
  effect the following local day.
- Accept only valid IANA timezones, such as `Asia/Bangkok`.

### Security

- Change password using the current password, new password, and confirmation.
- Require at least eight characters.
- Provide show/hide controls and field-level errors in the frontend.

### Account

- Display email verification status.
- Log out from the current device.
- Link to privacy policy and terms when those pages are available.

## API contract

All endpoints require a bearer access token unless stated otherwise. Successful
responses are wrapped by the global response interceptor.

| Use case                 | Method and endpoint                  | Request                                         |
| ------------------------ | ------------------------------------ | ----------------------------------------------- |
| Load profile             | `GET /api/v1/users/profile`          | None                                            |
| Update profile           | `PUT /api/v1/users/profile`          | `{ username?, email?, avatar? }`                |
| Create avatar upload URL | `POST /api/v1/uploads/presign-image` | `{ contentType, fileName?, folder? }`           |
| Load learning goal       | `GET /api/v1/streak`                 | None                                            |
| Update learning goal     | `PATCH /api/v1/streak/settings`      | `{ dailyTarget?, timezone? }`                   |
| Change password          | `POST /api/v1/users/change-password` | `{ oldPassword, newPassword, confirmPassword }` |

Recommended avatar upload request:

```json
{
  "contentType": "image/jpeg",
  "fileName": "avatar.jpg",
  "folder": "avatars"
}
```

The frontend uploads the file to the returned `uploadUrl`, then sends the
returned HTTPS `fileUrl` as `avatar` to `PUT /api/v1/users/profile`.

## Frontend structure

Use `/settings` with four independently saved sections:

```text
Settings
|-- Profile
|-- Learning goal
|-- Security
`-- Account
```

On desktop, use section navigation beside a content panel. On mobile, stack the
sections as cards. Each section owns its loading, dirty, saving, success, and
error states. Do not use one global Save button because the sections call
different endpoints.

## Delivery phases

### Phase 1: Backend readiness

- [x] Profile read and update endpoints
- [x] Password change endpoint
- [x] Streak settings read and update endpoints
- [x] Presigned image upload endpoint
- [x] Avatar field in profile updates
- [x] Email verification reset on a changed email
- [x] IANA timezone validation
- [ ] Endpoint to resend email verification

### Phase 2: Settings shell

- [ ] Add `/settings` route.
- [ ] Add responsive navigation and section layout.
- [ ] Load profile and streak status in parallel.
- [ ] Add skeleton, retry, and authentication-expired states.

### Phase 3: Profile

- [ ] Build profile form with client-side validation.
- [ ] Add image preview, MIME type/size checks, and upload progress.
- [ ] Upload avatar using the presigned URL.
- [ ] Save the returned URL with the profile.
- [ ] Refresh the global authenticated-user state after saving.

### Phase 4: Learning goal

- [ ] Add target presets and custom input.
- [ ] Add an IANA timezone selector defaulting to the browser timezone.
- [ ] Explain and display pending target changes.

### Phase 5: Security and account

- [ ] Build the change-password form.
- [ ] Add current-device logout.
- [ ] Display verification status and static account links.

### Phase 6: Quality assurance

- [ ] Test mobile and desktop layouts.
- [ ] Test keyboard navigation and accessible labels.
- [ ] Test duplicate email, invalid avatar URL, invalid timezone, wrong current
      password, expired token, and network failure cases.
- [ ] Confirm unsaved-change warnings and duplicate-submit prevention.

## Deferred work

- Notification preferences and reminder scheduling
- Theme and application-language preferences persisted across devices
- Resend-email-verification flow
- Active-session management and logout from all devices
- User data export
- Self-service account deletion with password confirmation and a recovery window

These require new persistence or security-sensitive backend flows and should not
be represented as working controls until their APIs exist.

## MVP acceptance criteria

- A user can view and update username, email, and avatar.
- A changed email becomes unverified; saving an unchanged email does not alter
  verification status.
- A user can update their daily target and valid IANA timezone.
- A user can change their password after confirming the current password.
- Sensitive user fields never appear in API responses.
- Every form provides loading, validation, error, and success feedback.
- The settings page works on mobile and desktop.
