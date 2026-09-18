import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Cite, plugins } from "@citation-js/core";
import "@citation-js/plugin-csl";
import "@citation-js/plugin-bibtex";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  data: path.join(root, "src", "data", "publications.json"),
  gb: path.join(root, "src", "styles", "china-national-standard-gb-t-7714-2015-numeric.csl"),
  ieee: path.join(root, "src", "styles", "ieee.csl"),
  zh: path.join(root, "src", "styles", "locales-zh-CN.xml"),
  page: path.join(root, "dist", "index.html"),
  outputData: path.join(root, "dist", "data", "publications.json"),
  cms: path.join(root, "cms", "teacher-profile-body.html")
};

const [records, gbStyle, ieeeStyle, zhLocale, pageSource] = await Promise.all([
  fs.readFile(files.data, "utf8").then(JSON.parse),
  fs.readFile(files.gb, "utf8"),
  fs.readFile(files.ieee, "utf8"),
  fs.readFile(files.zh, "utf8"),
  fs.readFile(files.page, "utf8")
]);

if (!Array.isArray(records) || records.length !== 19) {
  throw new Error(`Expected exactly 19 publication records; found ${records.length}.`);
}

const required = ["id", "type", "title", "author", "container-title", "issued", "DOI", "URL"];
const ids = new Set();
for (const record of records) {
  for (const key of required) {
    if (!record[key] || (Array.isArray(record[key]) && record[key].length === 0)) {
      throw new Error(`${record.id || "Unknown record"} is missing ${key}.`);
    }
  }
  if (ids.has(record.id)) throw new Error(`Duplicate publication id: ${record.id}`);
  ids.add(record.id);
  if (!record.URL.startsWith("https://doi.org/")) throw new Error(`${record.id} must use a canonical HTTPS DOI URL.`);
}

const cslConfig = plugins.config.get("@csl");
cslConfig.styles.add("gbt7714", gbStyle);
cslConfig.styles.add("ieee-local", ieeeStyle);
cslConfig.locales.add("zh-CN", zhLocale);

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const cslRecord = ({ _faculty, ...record }) => {
  if (record.DOI) delete record.URL;
  return record;
};
const clean = (value) => value
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;|\u00a0/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const citeText = (record) => clean(new Cite([cslRecord(record)]).format("bibliography", {
  format: "text",
  template: "gbt7714",
  lang: "zh-CN"
}));

const yearOf = (record) => String(record.issued["date-parts"][0][0]);
const sorted = [...records].sort((a, b) => Number(yearOf(b)) - Number(yearOf(a)) || records.indexOf(a) - records.indexOf(b));
const years = [...new Set(sorted.map(yearOf))];

const venueAliases = new Map([
  ["Information Fusion", "Information Fusion"],
  ["Knowledge-Based Systems", "KBS"],
  ["Neurocomputing", "Neurocomputing"],
  ["Tsinghua Science and Technology", "TST"],
  ["IEEE Transactions on Computational Social Systems", "IEEE TCSS"],
  ["Information Processing & Management", "IP&M"],
  ["Expert Systems with Applications", "ESWA"],
  ["Information Sciences", "Information Sciences"],
  ["Journal of the Franklin Institute", "JFI"],
  ["The Computer Journal", "Computer Journal"]
]);

const shortVenueOf = (record) => {
  const faculty = record._faculty || {};
  if (faculty.venueShort) return faculty.venueShort;
  if ((faculty.searchTerms || []).length) return faculty.searchTerms[0];
  if (venueAliases.has(record["container-title"])) return venueAliases.get(record["container-title"]);
  const parenthetical = record["container-title"].match(/\(([A-Z][A-Z0-9&-]{1,})(?:\s+\d{4})?\)/);
  if (parenthetical) return parenthetical[1];
  const acronym = record["container-title"].match(/\b[A-Z][A-Z0-9&-]{2,}\b/);
  return acronym?.[0] || record["container-title"];
};

const normalizeName = (value) => value.toLocaleLowerCase("en-US").replace(/[^a-z]/g, "");
const authorsMarkup = (record) => {
  const faculty = record._faculty || {};
  const corresponding = new Set((faculty.corresponding || []).map(normalizeName));
  return record.author.map((author) => {
    const fullName = `${author.given} ${author.family}`.trim();
    const isCorresponding = corresponding.has(normalizeName(fullName));
    const isProfileOwner = normalizeName(fullName) === "guangquanlu";
    const content = `${escapeHtml(fullName)}${isCorresponding ? "*" : ""}`;
    return isProfileOwner ? `<strong>${content}</strong>` : content;
  }).join(", ");
};

const sourceMarkup = (record) => {
  const year = yearOf(record);
  if (record.type === "paper-conference") {
    return `in ${escapeHtml(record["container-title"])}, ${year}.`;
  }
  const volumeIssue = record.volume
    ? `, ${escapeHtml(record.volume)}${record.issue ? `(${escapeHtml(record.issue)})` : ""}`
    : "";
  const pages = record.page ? `: ${escapeHtml(record.page)}` : "";
  return `${escapeHtml(record["container-title"])}${volumeIssue}${pages}, ${year}.`;
};

const publicationKinds = [
  { type: "paper-conference", id: "conference", title: "会议论文" },
  { type: "article-journal", id: "journal", title: "期刊论文" }
];

const groupMarkup = publicationKinds.map((kind) => {
  const entries = sorted.filter((record) => record.type === kind.type).map((record, index) => {
    const faculty = record._faculty || {};
    const year = yearOf(record);
    const yearShort = year.slice(-2);
    const labelSuffix = (faculty.labels || []).length ? `, ${(faculty.labels || []).join(", ")}` : "";
    const venueLabel = `(${shortVenueOf(record)} ${yearShort}${labelSuffix})`;
    const corresponding = (faculty.corresponding || []).length
      ? `<span class="publication-corresponding">（通讯作者）</span>`
      : "";
    const searchText = [record.title, record["container-title"], ...(record.author || []).flatMap((author) => [author.given, author.family, `${author.given} ${author.family}`]), ...(faculty.labels || []), ...(faculty.searchTerms || [])]
      .join(" ").toLocaleLowerCase("zh-CN");
    return `
            <li class="publication-item" data-publication-item data-id="${escapeHtml(record.id)}" data-year="${year}" data-type="${escapeHtml(record.type)}" data-search="${escapeHtml(searchText)}">
              <span class="publication-number">${index + 1}.</span>
              <div class="publication-body">
                <p class="publication-heading"><span class="publication-venue">${escapeHtml(venueLabel)}</span><a class="publication-title" href="${escapeHtml(record.URL)}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.title)}<span class="sr-only">（在新标签页打开）</span></a></p>
                <p class="publication-detail">${authorsMarkup(record)}. ${sourceMarkup(record)} ${corresponding}</p>
                <div class="publication-actions" aria-label="${escapeHtml(record.title)} 的操作">
                  <a href="${escapeHtml(record.URL)}" target="_blank" rel="noopener noreferrer">DOI<span class="sr-only">（在新标签页打开）</span></a>
                  <span aria-hidden="true">·</span>
                  <button type="button" data-copy-style="gbt" data-publication-id="${escapeHtml(record.id)}">复制 GB/T</button>
                  <span aria-hidden="true">·</span>
                  <button type="button" data-copy-style="ieee" data-publication-id="${escapeHtml(record.id)}">复制 IEEE</button>
                  <span aria-hidden="true">·</span>
                  <button type="button" data-copy-style="bibtex" data-publication-id="${escapeHtml(record.id)}">复制 BibTeX</button>
                </div>
              </div>
            </li>`;
  }).join("");
  return `
          <section class="publication-group" data-publication-group data-publication-kind="${kind.type}" aria-labelledby="publication-group-${kind.id}">
            <h3 id="publication-group-${kind.id}">${kind.title}</h3>
            <ol>${entries}
            </ol>
          </section>`;
}).join("");

const filters = `
        <details class="publication-tools">
          <summary>论文检索与引用工具</summary>
          <div class="publication-tools__panel">
            <form id="publication-filters" class="publication-filters" role="search" aria-label="论文检索">
              <div class="filter-field filter-field--search">
                <label for="publication-search">关键词</label>
                <input id="publication-search" name="q" type="search" placeholder="搜索题名、作者或期刊/会议" autocomplete="off">
              </div>
              <div class="filter-field">
                <label for="publication-year">年份</label>
                <select id="publication-year" name="year">
                  <option value="">全部年份</option>
                  ${years.map((year) => `<option value="${year}">${year}</option>`).join("")}
                </select>
              </div>
              <div class="filter-field">
                <label for="publication-type">类型</label>
                <select id="publication-type" name="type">
                  <option value="">全部类型</option>
                  <option value="article-journal">期刊论文</option>
                  <option value="paper-conference">会议论文</option>
                </select>
              </div>
              <button class="filter-reset" type="button" data-reset>重置</button>
            </form>
            <div class="publication-summary">
              <p id="publication-result-count">显示 19 / 19 篇</p>
              <p>支持复制 GB/T 7714—2015、IEEE 与 BibTeX</p>
            </div>
          </div>
        </details>
        <div id="publication-list" class="publication-list">${groupMarkup}
        </div>
        <p id="publication-empty" class="publication-empty" hidden>没有符合当前条件的论文，请调整关键词或筛选条件。</p>
        <p id="publication-status" class="sr-only" aria-live="polite"></p>
        <script id="publication-data" type="application/json">${JSON.stringify(records).replaceAll("<", "\\u003c")}</script>`;

const start = "<!-- PUBLICATIONS:START -->";
const end = "<!-- PUBLICATIONS:END -->";
if (!pageSource.includes(start) || !pageSource.includes(end)) {
  throw new Error("Publication build markers are missing from dist/index.html.");
}
const page = pageSource.replace(new RegExp(`${start}[\\s\\S]*?${end}`), `${start}\n${filters}\n        ${end}`);
await fs.mkdir(path.dirname(files.outputData), { recursive: true });
await fs.mkdir(path.dirname(files.cms), { recursive: true });
await fs.writeFile(files.page, page, "utf8");
await fs.writeFile(files.outputData, `${JSON.stringify(records, null, 2)}\n`, "utf8");

const article = page.match(/<!-- PROFILE:START -->[\s\S]*?<!-- PROFILE:END -->/)?.[0]
  .replace("<!-- PROFILE:START -->", "")
  .replace("<!-- PROFILE:END -->", "")
  .trim();
if (!article) throw new Error("Could not extract the CMS article fragment.");
const cmsFragment = `<!-- Webplus 教师主页正文片段：资源路径请按学院模板上传位置调整 -->
<link rel="stylesheet" href="/teacher-profile/assets/teacher-profile.css">
${article}
<script src="/teacher-profile/assets/teacher-profile.js" defer><\/script>
`;
await fs.writeFile(files.cms, cmsFragment, "utf8");

console.log(`Built ${records.length} publications in ${publicationKinds.length} type groups across ${years.length} years.`);
