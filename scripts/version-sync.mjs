import fs from "node:fs";
import path from "node:path";

function bumpPatch(v) {
    const m = /^(\d+)\.(\d+)\.(\d+)(.*)?$/.exec(v);
    if (!m) throw new Error(`Invalid semver: ${v}`);
    const major = Number(m[1]);
    const minor = Number(m[2]);
    const patch = Number(m[3]) + 1;
    const suffix = m[4] ?? "";
    return `${major}.${minor}.${patch}${suffix}`;
}

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

const root = process.cwd();
const pkgPath = path.join(root, "package.json");
if (!fs.existsSync(pkgPath)) {
    console.log("version-sync: no package.json, skipping");
    process.exit(0);
}

const pkg = readJson(pkgPath);
if (!pkg.version) throw new Error("package.json missing version");

const next = bumpPatch(pkg.version);
pkg.version = next;
writeJson(pkgPath, pkg);

console.log(`version-sync: ${pkg.name ?? "package"} -> ${next}`);
