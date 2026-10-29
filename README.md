# QuantForge AI Assistant

A source-grounded, C++-only guidance assistant for the sibling `quant-forge` repository. It retrieves symbols from a committed index of public QuantForge headers, then streams Gemini responses with visible source citations.

## Guardrails

- Guidance and code recommendations only: the app does not execute C++, process raw data, or modify QuantForge.
- The indexer reads only public `ql/**/*.hpp` headers and ignores Git data, tests, builds, caches, virtual environments, and generated artifacts.
- Chat retrieval sends only top-ranked symbol metadata to the model. A request with no indexed match receives a deterministic no-match response instead of a model call.
- CSV parsing happens in the browser with headers plus at most three preview rows. Only that metadata is sent to the chat route.

## Local setup

1. Use Node.js 20 or newer and make sure `../quant-forge/ql` exists beside this project.
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` to a Google Gemini API key. Do not use a `NEXT_PUBLIC_` key.
3. Install packages with `npm install`.
4. Generate the checked-in repository snapshot with `npm run index-repo`.
5. Run `npm run dev`, then open `http://localhost:3000`.

Useful checks:

```bash
npm test
npm run lint
npm run build
```

Re-run `npm run index-repo` whenever the sibling QuantForge headers change, then commit the updated `src/data/quant-forge-index.json` with the app.

## Vercel deployment

1. Import the `quant-forge-ai` repository into Vercel.
2. In **Project Settings → Environment Variables**, add `GEMINI_API_KEY` for Production (and Preview if needed).
3. Deploy normally. The app imports its committed JSON index at build/runtime, so Vercel does not need the sibling `quant-forge` checkout.

`gemini-3.5-flash` is used because the originally requested Gemini 2.0/1.5 models are no longer active. Usage remains subject to the Gemini account's available free-tier quota and rate limits.
