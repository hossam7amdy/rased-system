// Loads .env once at module-eval time. Imported for its side effect before any
// module reads process.env. Missing .env is fine — the host (e.g. Bonto) or the
// real environment provides the vars.
try {
	process.loadEnvFile();
} catch (err) {
	if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}
