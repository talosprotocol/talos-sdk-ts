/**
 * Version sync script for pre-commit hook
 * Auto-increments patch version on every commit
 */
import fs from "node:fs";

function bumpPatch(v) {
    const m = /^(\d+)\.(\d+)\.(\d+)(.*)?$/.exec(v);
    if (!m) throw new Error(`Invalid semver: ${v}`);
    const major = Number(m[1]);
    const minor = Number(m[2]);
    const patch = Number(m[3]) + 1;
    const suffix = m[4] ?? "";
    return `${major}.${minor}.${patch}${suffix}`;
}

function updateJson(path) {
    const raw = fs.readFileSync(path, "utf8");
    const obj = JSON.parse(raw);
    if (!obj.version || typeof obj.version !== "string") return false;
    const oldVersion = obj.version;
    const next = bumpPatch(obj.version);
    obj.version = next;
    fs.writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
    console.log(`📦 Version bumped: ${oldVersion} → ${next}`);
    return true;
}

const changed = updateJson("package.json");

if (!changed) {
    console.log("ℹ️  No version field found in package.json");
}
