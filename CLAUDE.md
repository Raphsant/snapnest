# SnapNest Mobile — project context

This is the SnapNest iOS app: React Native + Expo (Dev Client) + TypeScript.
Users record photos/videos in-app; media auto-uploads to S3 via presigned PUT
URLs issued by the NestJS backend (separate repo — never modify backend code
from here; if a backend change seems needed, stop and say so).

Stack specifics:
- Expo Dev Client, built with EAS, distributed via TestFlight
- State: zustand. Server state: @tanstack/react-query + axios
- Camera: expo-camera (CameraView)
- Auth: AWS Cognito (JWT bearer on all API calls)
- Upload flow: create upload job via API → receive presigned PUT URL(s) →
  upload directly to S3 → call the job's /complete endpoint
- Always use `npx expo` (never bare `expo` — the global CLI is deprecated and
  breaks resolution)
- EXPO_PUBLIC_* env vars are inlined at bundle time

House rules — non-negotiable:
1. Before writing code, list the files you plan to touch and wait for approval.
2. One file at a time: full diff, stop, wait for confirmation.
3. No new dependencies without asking first. When approved, install Expo
   packages with `npx expo install`.
4. No refactors, renames, or cleanups outside the stated task scope.
5. Unit tests or type-checks passing is not proof a feature works — the user
   verifies on device/simulator.
