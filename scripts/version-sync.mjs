import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import console from "node:console";

function bumpPatch(v) {
    const m = /^(\d+)\.(\d+)\.(\d+)(.*)?$/.exec(v);
    if (!m) throw new Error(`Invalid semver: ${v}`);
    const major = Number(m[1]);
    const minor = Number(m[2]);
    const patch = Number(m[3]) + 1;
    const suffix = m[4] ?? "";
    return `${major}.${minor}.${patch}${suffix}`;
}

const root = process.cwd();
const pkgPath = path.join(root, "package.json");
if (!fs.existsSync(pkgPath)) process.exit(0);

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
if (!pkg.version) throw new Error("package.json missing version");

pkg.version = bumpPatch(pkg.version);
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log(`version-sync: ${pkg.name ?? "package"} -> ${pkg.version}`);
