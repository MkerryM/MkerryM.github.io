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

let publicationNumber = 0;
const groupMarkup = years.map((year) => {
  const entries = sorted.filter((record) => yearOf(record) === year).map((record) => {
    publicationNumber += 1;
    const citation = citeText(record).replace(/^\[\d+\]\s*/, "");
    const escapedCitation = escapeHtml(citation);
    const escapedTitle = escapeHtml(record.title);
    const linkedCitation = escapedCitation.includes(escapedTitle)
      ? escapedCitation.replace(escapedTitle, `<a class="publication-title" href="${escapeHtml(record.URL)}" target="_blank" rel="noopener noreferrer">${escapedTitle}<span class="sr-only">（在新标签页打开）</span></a>`)
      : escapedCitation;
    const faculty = record._faculty || {};
    const labels = (faculty.labels || []).map((label) => `<span class="publication-label">${escapeHtml(label)}</span>`).join("");
    const corresponding = (faculty.corresponding || []).length
      ? `<span class="publication-note">通讯作者：${escapeHtml(faculty.corresponding.join("、"))}</span>`
      : "";
    const searchText = [record.title, record["container-title"], ...(record.author || []).flatMap((author) => [author.given, author.family, `${author.given} ${author.family}`]), ...(faculty.labels || []), ...(faculty.searchTerms || [])]
      .join(" ").toLocaleLowerCase("zh-CN");
    return `
            <li class="publication-item" data-publication-item data-id="${escapeHtml(record.id)}" data-year="${year}" data-type="${escapeHtml(record.type)}" data-search="${escapeHtml(searchText)}">
              <div class="publication-citation"><span class="publication-number">[${publicationNumber}]</span><p>${linkedCitation}</p></div>
              <div class="publication-meta">${labels}${corresponding}</div>
              <div class="publication-actions" aria-label="${escapeHtml(record.title)} 的操作">
                <a href="${escapeHtml(record.URL)}" target="_blank" rel="noopener noreferrer">DOI<span class="sr-only">（在新标签页打开）</span></a>
                <button type="button" data-copy-style="gbt" data-publication-id="${escapeHtml(record.id)}">复制 GB/T</button>
                <button type="button" data-copy-style="ieee" data-publication-id="${escapeHtml(record.id)}">复制 IEEE</button>
                <button type="button" data-copy-style="bibtex" data-publication-id="${escapeHtml(record.id)}">复制 BibTeX</button>
              </div>
            </li>`;
  }).join("");
  return `
          <section class="publication-year" data-publication-group data-year-group="${year}" aria-labelledby="publication-year-${year}">
            <h3 id="publication-year-${year}">${year}</h3>
            <ol>${entries}
            </ol>
          </section>`;
}).join("");

const filters = `
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
          <p>默认按 GB/T 7714—2015 格式显示</p>
        </div>
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

console.log(`Built ${records.length} publications across ${years.length} year groups.`);
