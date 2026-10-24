# ISO Agents — notes for AI coding agents

- Read `README.md` first. Tests: `npm test` (no API calls, synthetic fixtures). Typecheck: `npm run typecheck`.
- Never commit: `.env*` (except `.env.example`), `salidas/`, official ISO requirement text under `normas/<standard>/` (copyrighted; only the paraphrased guides in `normas/comun/` and the `NOTA.md` placeholders are versioned), or any real client document. Every example uses a fictional company.
- Code, comments and tool outputs are in Spanish (the users are Spanish-speaking auditors); the README is in English. Keep both.
- The model proposes, the code enforces: never hardcode values in deliverables (no fixed "Sí", no invented document codes), never trust the model to obey a prompt rule when code can check it. See `src/lib/herramienta.ts` and `src/lib/fidelidad.ts`.
- New clause = new `HerramientaSpec` in `src/tools/clausulaN/` registered in `src/index.ts`, plus the normative reference file for its code in `normas/`.
