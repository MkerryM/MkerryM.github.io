import { Cite, plugins } from "@citation-js/core";
import "@citation-js/plugin-csl";
import "@citation-js/plugin-bibtex";
import gbStyle from "./styles/china-national-standard-gb-t-7714-2015-numeric.csl";
import ieeeStyle from "./styles/ieee.csl";
import zhLocale from "./styles/locales-zh-CN.xml";

const cslConfig = plugins.config.get("@csl");
cslConfig.styles.add("gbt7714", gbStyle);
cslConfig.styles.add("ieee-local", ieeeStyle);
cslConfig.locales.add("zh-CN", zhLocale);

const cleanCitation = (value) => value
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;|\u00a0/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const recordForCitation = (record) => {
  const { _faculty, ...cslRecord } = record;
  if (cslRecord.DOI) delete cslRecord.URL;
  return cslRecord;
};

const formatCitation = (record, style) => {
  const cite = new Cite([recordForCitation(record)]);
  if (style === "bibtex") return cite.format("bibtex").trim();
  return cleanCitation(cite.format("bibliography", {
    format: "text",
    template: style === "ieee" ? "ieee-local" : "gbt7714",
    lang: style === "ieee" ? "en-US" : "zh-CN"
  }));
};

const writeClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("copy-failed");
};

const dataNode = document.querySelector("#publication-data");
const form = document.querySelector("#publication-filters");

if (dataNode && form) {
  const records = JSON.parse(dataNode.textContent);
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const search = form.elements.namedItem("q");
  const year = form.elements.namedItem("year");
  const type = form.elements.namedItem("type");
  const reset = form.querySelector("[data-reset]");
  const items = [...document.querySelectorAll("[data-publication-item]")];
  const groups = [...document.querySelectorAll("[data-publication-group]")];
  const resultCount = document.querySelector("#publication-result-count");
  const empty = document.querySelector("#publication-empty");
  const status = document.querySelector("#publication-status");

  const announce = (message) => {
    status.textContent = "";
    window.setTimeout(() => { status.textContent = message; }, 20);
  };

  const update = ({ pushUrl = true } = {}) => {
    const query = search.value.trim().toLocaleLowerCase("zh-CN");
    const selectedYear = year.value;
    const selectedType = type.value;
    let shown = 0;

    items.forEach((item) => {
      const matchesQuery = !query || item.dataset.search.includes(query);
      const matchesYear = !selectedYear || item.dataset.year === selectedYear;
      const matchesType = !selectedType || item.dataset.type === selectedType;
      item.hidden = !(matchesQuery && matchesYear && matchesType);
      if (!item.hidden) shown += 1;
    });

    groups.forEach((group) => {
      group.hidden = !group.querySelector("[data-publication-item]:not([hidden])");
    });

    resultCount.textContent = `显示 ${shown} / ${items.length} 篇`;
    empty.hidden = shown !== 0;

    if (pushUrl) {
      const params = new URLSearchParams(window.location.search);
      query ? params.set("q", search.value.trim()) : params.delete("q");
      selectedYear ? params.set("year", selectedYear) : params.delete("year");
      selectedType ? params.set("type", selectedType) : params.delete("type");
      const next = `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
    }
  };

  const params = new URLSearchParams(window.location.search);
  search.value = params.get("q") || "";
  year.value = params.get("year") || "";
  type.value = params.get("type") || "";
  update({ pushUrl: false });

  let searchTimer;
  search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(update, 120);
  });
  year.addEventListener("change", update);
  type.addEventListener("change", update);
  reset.addEventListener("click", () => {
    form.reset();
    update();
    search.focus();
  });

  document.querySelectorAll("[data-research-filter]").forEach((link) => {
    link.addEventListener("click", () => {
      search.value = link.dataset.researchFilter;
      year.value = "";
      type.value = "";
      update();
    });
  });

  document.querySelector("#publication-list").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-style]");
    if (!button) return;
    const record = recordMap.get(button.dataset.publicationId);
    if (!record) return;
    const label = button.dataset.copyStyle === "gbt" ? "GB/T 7714" : button.dataset.copyStyle === "ieee" ? "IEEE" : "BibTeX";
    try {
      await writeClipboard(formatCitation(record, button.dataset.copyStyle));
      announce(`已复制 ${label} 引用`);
      const original = button.textContent;
      button.textContent = "已复制";
      window.setTimeout(() => { button.textContent = original; }, 1400);
    } catch {
      announce("复制失败，请手动选择引用文本");
    }
  });
}
