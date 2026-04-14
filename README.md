# Ad → Landing Page Optimizer

Next.js app that analyzes an ad creative (vision), scrapes a landing page with **Playwright**, runs a **four-stage Gemini** pipeline (ad analysis → page analysis → gap analysis → HTML transform), and returns **optimized HTML** plus a structured change report.

## Prerequisites

- **Node.js** ≥ 20.9 (repo pins **22** in [`.nvmrc`](./.nvmrc)). Use **fnm**, **nvm-windows**, or **Volta** so the toolchain stays **per-project** (no global dependency pollution).
- **Google AI Studio API key** (free tier) from [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey). Set `GEMINI_API_KEY` in `.env`. Optional: `GEMINI_MODEL` (default `gemini-2.0-flash`).

## Setup (isolated environment)

From this directory:

```bash
fnm use   # or: nvm use
npm install
npm run playwright:install
cp .env.example .env
# edit .env — set GEMINI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Why Docker / Fly / Railway?

Playwright needs a full browser and a generous timeout. Running the app in a **container** that includes Chromium (see [`Dockerfile`](./Dockerfile)) matches the plan’s deployment guidance better than bare Vercel serverless.

### Docker

```bash
docker build -t ad-lp-optimizer .
docker run --rm -p 3000:3000 -e GEMINI_API_KEY=your_key ad-lp-optimizer
```

### Fly.io (outline)

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/).
2. `fly launch` in this folder (pick region, attach secrets).
3. `fly secrets set GEMINI_API_KEY=...`
4. `fly deploy`
5. Use the issued **https://…fly.dev** URL as your live demo.

### Railway (outline)

1. New project → deploy from this repo.
2. Set variable `GEMINI_API_KEY`.
3. Use Dockerfile build; expose port **3000**.

Replace the placeholder “live demo URL” in your checklist with the URL Fly or Railway prints after deploy.

## API

- `GET /api/preview?url=` — returns JSON `{ imageBase64, contentType, finalUrl }` (page screenshot).
- `POST /api/optimize` — `multipart/form-data` with `landingUrl`, optional `adImage` file / `adImageUrl`, optional marketer hints, optional `useManualHtml` + `manualHtml`. Response is **NDJSON** stream: `{type:"stage",...}` lines then `{type:"result",payload:{...}}`.

## Environment & Dependency Versions

Captured from [`package.json`](./package.json) at authoring time (**2026-04-13**). Re-run locally after `npm install` to refresh exact resolved versions:

```bash
node -v
npm -v
npm list --depth=0
```

| Package | Version (declared) |
| --- | --- |
| next | 15.1.6 |
| react | ^19.0.0 |
| react-dom | ^19.0.0 |
| @google/generative-ai | ^0.21.0 |
| playwright | ^1.49.1 |
| zod | ^3.24.1 |
| tailwindcss | ^3.4.17 |
| typescript | ^5.7.2 |
| eslint | ^9.18.0 |
| eslint-config-next | 15.1.6 |
| @radix-ui/react-collapsible | ^1.1.2 |
| @radix-ui/react-label | ^2.1.1 |
| @radix-ui/react-progress | ^1.1.1 |
| @radix-ui/react-slot | ^1.1.1 |
| @radix-ui/react-switch | ^1.1.2 |
| @radix-ui/react-tabs | ^1.1.2 |
| class-variance-authority | ^0.7.1 |
| clsx | ^2.1.1 |
| lucide-react | ^0.469.0 |
| tailwind-merge | ^2.6.0 |
| tailwindcss-animate | ^1.0.7 |

**Runtime:** Node ≥ 20.9 (see `engines`). **OS (Docker base):** Ubuntu Jammy image from `mcr.microsoft.com/playwright:v1.49.1-jammy`.

## License

Private / use as you see fit.
