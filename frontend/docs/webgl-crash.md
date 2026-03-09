# WebGL `shaderPreludeCode` Crash

## The error

```
Cannot read properties of undefined (reading 'shaderPreludeCode')
```

This is a known MapLibre GL crash. It happens randomly and is **not caused by our code**.

## Why it happens

1. The browser's GPU process drops the WebGL context. Common triggers:
   - Tab is backgrounded for a while
   - OS reclaims GPU memory under pressure
   - System sleep/wake cycle
   - Too many WebGL contexts open across tabs

2. react-map-gl calls `setProps` -> `redraw` on its next render cycle.

3. MapLibre's painter tries to compile shaders on the now-dead context, accesses an undefined internal property, and throws synchronously.

4. Because this throw happens during React's render phase, it is an **unhandled render error** that crashes the entire app (blank screen / white page).

## How the fix works

File: `src/components/WebGLErrorBoundary.tsx`
Used in: `src/map/GeojsonsMap.tsx` (wraps the `<DeckGL>` block)

```
<WebGLErrorBoundary>
  <DeckGL ...>
    <Map ... />
  </DeckGL>
</WebGLErrorBoundary>
```

The error boundary catches the render crash and **remounts** the entire DeckGL + Map subtree by incrementing a React `key`. This destroys the corrupted WebGL context and creates a fresh one.

- The map position is preserved because `viewState` lives in Zustand, outside the component tree.
- DeckGL layers are recreated every render (they're `new`'d in the component body), so there are no stale references.
- Sibling UI (toolbar, attribution, zoom controls) sits **outside** the boundary and is never unmounted.

### Retry limits

The boundary allows **3 retries within 10 seconds**. If the crash keeps recurring (e.g. the GPU is permanently unavailable), it stops retrying and shows a "Reload the page" fallback instead of looping forever.

## What you'll see when it triggers

- A brief visual flash as the map remounts (< 1 second)
- Console warning: `[WebGLErrorBoundary] recovering from render crash`
- The map reappears at the same position/zoom

If retries are exhausted:

- Console error: `[WebGLErrorBoundary] retries exhausted, giving up`
- A centered message: "The map crashed repeatedly. Reload the page"

## If the crash starts happening frequently

Frequent context loss usually means something is creating too many WebGL contexts. Things to check:

- Are multiple map instances being mounted without cleanup?
- Is hot-reload creating leaked contexts during development?
- Is the user's device low on GPU memory?

The boundary is a safety net, not a permanent fix for a context leak. If you see the crash more than once in a normal session, investigate the root cause.
