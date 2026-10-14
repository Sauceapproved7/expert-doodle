# Glow Society — standalone beauty prototype

A free-to-run, dependency-free, responsive HTML/CSS/JavaScript concept app. Designed to foreground Black women's beauty while welcoming everyone. This app is isolated in `apps/glow-society/` on a dedicated Git branch and does not modify any existing SauceApproved/Hercules production app.

## What works

- Mobile-first beauty exploration: **47 fictional demo looks** across lips, blush, eyes, natural/protective hairstyles and nails.
- Complexion-depth and warm/cool/neutral/olive undertone filters for makeup. Existing looks include deep and rich skin shades.
- Private favorites, multi-category saved looks, locally created posts, comments and likes, follow preferences.
- On-device camera AR: approximate MediaPipe face-landmark lip and cheek overlays; approximate MediaPipe hand-landmark nail overlays. Only activates after the user taps **Start camera**. Camera stops on page hide or navigation.
- Photo lab: user-controlled image file stays in the browser memory, with draggable manual colored overlays for lips, eyes, cheeks, hair color concepts, and nails.
- Artists directory; deliberately fictional demo profiles and no public booking actions.

## Important limitations

- **Not an ecommerce site.** Sample names, creator identities, endorsements, prices and results are fictional, and there is no checkout, inventory, payment, or real salon bookings.
- **Not a public women's social network yet.** Posts/comments/likes/follows are local browser demo data only. Public accounts require authentication, moderation, reporting, abuse prevention, and consent/privacy policies.
- **Not accurate product fitting or shade matching.** AR lip/cheek/nail placement is experimental and should be validated across deeper complexions, skin lighting and device cameras. Hair is manual color/concept placement, not live hairstyle replacement. Nail hand landmark ellipses are not salon-accurate nail geometry.
- Privacy: uploaded face/hand photos are held only in browser memory and not uploaded by the app. Favorites and posts use localStorage in this browser. The sample photo and the AR model/runtime assets load from external CDNs, which receive ordinary asset requests; live frames do not get posted by application code. The external model files are not self-hosted.
- Camera requires HTTPS and browser permission, and may fail on some phones.
- The name **Glow Society** is provisional and not cleared for trademark use.

## Run and verify

Serve this directory over localhost or HTTPS (for webcam access). No dependencies or credentials are needed.

```sh
node --check app.js
node test.mjs
python3 -m http.server 4173
```

Then open http://localhost:4173. For iPhone live tracking, use HTTPS hosting rather than a plain HTTP LAN URL.

## Test status

The static test checks JavaScript syntax, required navigation, referenced DOM IDs, and privacy messaging. It does **not** replace real-camera visual and landmark tests.

## Deployment

Render Static Site may use:
- Repository: `Sauceapproved7/expert-doodle`
- Branch: `feature/glow-society-standalone-v1-20261013`
- Build: `node apps/glow-society/test.mjs`
- Publish directory: `apps/glow-society`
- Optional environment: `SKIP_INSTALL_DEPS=true`
- Auto deploy: **off** to prevent unreviewed changes.

Do not point an existing live service or domain at this branch.