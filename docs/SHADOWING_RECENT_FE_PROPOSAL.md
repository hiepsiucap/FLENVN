# Frontend Proposal: Recent Shadowing Videos

## Objective

Add a recent-video section to the shadowing screen so a signed-in learner can quickly reopen a successfully prepared YouTube video.

The backend stores one entry per user and YouTube video. Reopening a video moves it to the top of the list. The API does not persist sentence position or learning progress.

## API contract

All requests use the existing API base URL and JWT bearer-token handling.

### Fetch recent videos

```http
GET /api/v1/shadowing/recent?limit=10
Authorization: Bearer <access-token>
```

`limit` is optional, defaults to `10`, and accepts values from `1` through `50`.

Successful response (`200`):

```json
[
  {
    "videoId": "k2h8PvLY6D4",
    "url": "https://www.youtube.com/watch?v=k2h8PvLY6D4",
    "title": "Example video title",
    "language": "en",
    "lastOpenedAt": "2026-09-23T10:00:00.000Z"
  }
]
```

The response is already scoped to the authenticated user and ordered by `lastOpenedAt` descending. The frontend should not send a user ID.

### Reopen a recent video

History items do not include transcript sentences. When the user selects one, call the existing prepare endpoint with the saved URL and language:

```http
POST /api/v1/shadowing/prepare
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=k2h8PvLY6D4",
  "language": "en"
}
```

Only after this request succeeds should the frontend open the shadowing player. A successful prepare also refreshes that video's `lastOpenedAt` value on the backend.

## Suggested frontend types

```ts
export interface RecentShadowingVideo {
  videoId: string;
  url: string;
  title: string;
  language: string;
  lastOpenedAt: string; // ISO 8601 UTC timestamp
}
```

Reuse the existing prepare-response type for the player rather than duplicating it in the recent-history feature.

## UI proposal

Place a **Recent videos** section below the YouTube URL form and above the active player. Initially request 10 items.

Each item should display:

- Video title, using one line with ellipsis for long titles.
- Language code or localized language name.
- Relative last-opened time, with the full local date/time available as accessible text or a tooltip.
- Optional YouTube thumbnail derived from `videoId`.

The whole card or row should be selectable. Do not add delete controls in this phase because the API does not support deleting history.

On narrow screens, use a horizontally scrollable card row or compact vertical list. On wider screens, use a small grid or vertical list that does not compete with the player.

## Interaction flow

### Initial page load

1. Render the URL form immediately.
2. Fetch `GET /shadowing/recent?limit=10` in parallel with other non-blocking page setup.
3. Show skeleton rows only in the recent section.
4. Render nothing or a small empty-state message when the response is an empty array.

Suggested empty-state copy: `Videos you prepare will appear here.`

### Selecting a recent item

1. Disable only the selected item and show an inline loading indicator.
2. Send its `url` and `language` to `POST /shadowing/prepare`.
3. On success, populate the player from the prepare response.
4. Move the selected item to the first position or refetch the recent list.
5. Scroll or focus the active player when appropriate, especially on mobile.

Avoid navigating directly to the player using only the history item because it has no transcript sentences.

### Preparing a new URL

After a normal prepare request succeeds, update the recent list by either:

- Invalidating/refetching the recent-video query; or
- Inserting/updating the item locally from the prepare response, then refetching in the background.

Do not add failed prepare requests to the UI history.

## State and caching

Recommended query key:

```ts
['shadowing', 'recent', { limit: 10 }]
```

Treat the server as the source of truth. A cache lifetime of one to five minutes is reasonable, but invalidate the query after every successful prepare request. Clear user-specific cached history when the user signs out or changes account.

Keep these states independent:

- Loading recent history.
- Preparing a pasted URL.
- Reopening an individual recent item.
- Active player data.

This prevents the entire form or history section from becoming disabled during one item operation.

## Error handling

| Response | Frontend behavior |
| --- | --- |
| `400` from recent list | Fall back to the default limit; this normally indicates a client bug. |
| `401` | Use the existing token-refresh/sign-in flow. Do not show another user's cached results. |
| `404` from prepare | Keep the recent item visible and show `This video no longer has usable captions.` |
| `429` | Keep the current screen and offer retry after a short delay. |
| `502` or `503` | Show a non-destructive error and allow retry. |
| Network failure | Preserve existing player data and provide retry for the failed operation. |

A recent-list failure should not block the URL form or an already loaded player. Log technical details through the existing client telemetry, while showing concise user-facing messages.

## Accessibility

- Give each item an accessible name such as `Open {video title} for shadowing`.
- Expose loading state with `aria-busy` on the selected item or recent section.
- Preserve visible keyboard focus.
- Do not communicate the selected/loading state through color alone.
- Format dates in the user's locale while retaining the original timestamp for assistive text.

## Acceptance criteria

- Opening the shadowing page fetches at most 10 recent videos for the signed-in user.
- Empty, loading, success, and failure states are handled without blocking the URL form.
- Items appear in the order returned by the API.
- Selecting an item calls `POST /shadowing/prepare` with its saved URL and language.
- The player opens only after prepare succeeds.
- A successfully prepared or reopened video appears first without a full page reload.
- A failed prepare does not create a new local history item or reorder an existing one.
- Long titles, unavailable thumbnails, and unknown language codes degrade gracefully.
- Signing out clears recent-video data from the client cache.
- The UI works with keyboard navigation and common mobile viewport sizes.

## Out of scope

- Deleting or pinning history items.
- Pagination or infinite scrolling.
- Synchronizing playback position or completed sentences.
- Displaying learning progress.
- Client-side deduplication; the backend already maintains one row per user/video.

## Delivery dependency

The frontend work can be developed against a mock response now, but it should not be released as active functionality until the backend recent-history code and its database migration are committed, deployed, and verified in the target environment.
