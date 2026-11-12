# Argandu Farms — staff app

The phone app for farm staff (Expo, React Native). It signs in with the same
email and password as the website and records straight into it. See
[docs/MOBILE.md](../docs/MOBILE.md) for what it does and how it's built.

```bash
cd mobile
npm install
npx expo start          # then press a (Android), i (iPhone) or w (browser)
```

It talks to the live site unless `EXPO_PUBLIC_API_URL` says otherwise
(see `.env.example`).

To make an installable Android file (needs an Expo account: `npx eas-cli login`):

```bash
npx eas-cli build -p android --profile preview
```
