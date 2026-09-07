
# Toy & Stationery POS

Offline desktop POS starter project.

## Stack
- Electron
- Node.js
- Next.js
- TypeScript
- SQLite
- Prisma
- electron-builder

## Start
1. Copy `.env.example` to `.env`
2. Run `npm install`
3. Run `npx prisma generate`
4. Run `npx prisma migrate dev --name init`
5. Run `npm run dev`

## Build installer
Run `npm run dist`
