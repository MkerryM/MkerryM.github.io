import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const page = await fs.readFile(path.join(root, "dist", "index.html"), "utf8");
const data = JSON.parse(await fs.readFile(path.join(root, "dist", "data", "publications.json"), "utf8"));

const count = (pattern) => [...page.matchAll(pattern)].length;
const assertions = [
  [data.length === 19, `Expected 19 publication records, found ${data.length}`],
  [count(/data-publication-item/g) === 19, "Generated page must contain 19 publication items"],
  [count(/class="publication-title"/g) === 19, "Every publication title must be a hyperlink"],
  [count(/data-copy-style="gbt"/g) === 19, "Every publication must expose GB/T copy"],
  [count(/data-copy-style="ieee"/g) === 19, "Every publication must expose IEEE copy"],
  [count(/data-copy-style="bibtex"/g) === 19, "Every publication must expose BibTeX copy"],
  [page.includes('id="publication-filters"'), "Publication filters are missing"],
  [page.includes('id="publication-empty"'), "Publication empty state is missing"],
  [!page.includes('class="site-header"') && !page.includes('class="primary-nav"') && !page.includes('class="site-footer"'), "Preview must not duplicate the school header, navigation, or footer"],
  [page.includes('src="assets/teacher-profile.js"'), "Client bundle is missing from the page"],
  [await fs.stat(path.join(root, "dist", "assets", "teacher-profile.js")).then(() => true, () => false), "Client bundle file is missing"],
  [await fs.stat(path.join(root, "cms", "teacher-profile-body.html")).then(() => true, () => false), "CMS fragment is missing"],
  [count(/<!-- PROFILE:START -->/g) === 1 && count(/<!-- PROFILE:END -->/g) === 1, "Profile extraction markers are missing"]
];

const failures = assertions.filter(([passed]) => !passed).map(([, message]) => message);
const cms = await fs.readFile(path.join(root, "cms", "teacher-profile-body.html"), "utf8");
if ([...cms.matchAll(/data-publication-item/g)].length !== 19) failures.push("CMS fragment must contain all 19 publication items");
if (/site-header|primary-nav|site-footer/.test(cms)) failures.push("CMS fragment must contain teacher body content only");
if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Validated page structure, 19 linked publications, citation actions, and CMS bundle.");
}
