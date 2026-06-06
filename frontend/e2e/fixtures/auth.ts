import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const adminTest = base.extend({
	storageState: path.join(__dirname, "../.auth/admin.json"),
});

export const professorTest = base.extend({
	storageState: path.join(__dirname, "../.auth/professor.json"),
});

export const studentTest = base.extend({
	storageState: path.join(__dirname, "../.auth/student.json"),
});
