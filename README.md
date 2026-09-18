# 陆广泉教授主页改版

本项目是面向广西师范大学 SUDY/Webplus 的教师主页正文交付包。正文框架以东南大学金嘉晖教师主页为唯一版式参照，采用“左图右信息 + 白底纵向学术栏目 + 蓝色分节标题”，同时提供19篇论文的检索、筛选、外链和标准引用复制。学校系统自带的页头、导航、面包屑和页脚不在本包内重复实现。

## 交付内容

- `dist/index.html`：不含学校页头、导航和页脚的正文预览页。
- `cms/teacher-profile-body.html`：用于 Webplus 模板的正文片段。
- `dist/assets/teacher-profile.css`：页面样式；教师正文样式使用独立类名，不覆盖学院导航样式。
- `dist/assets/teacher-profile.js`：已内置 Citation.js、GB/T 7714 和 IEEE CSL 样式的浏览器脚本，运行时不访问 CDN。
- `dist/data/publications.json`：发布版 CSL-JSON 数据。
- `src/data/publications.json`：论文唯一维护源。

## Webplus 接入

1. 备份当前教师页面正文和关联模板资源。
2. 将 `dist/assets/teacher-profile.css` 与 `dist/assets/teacher-profile.js` 上传到站点资源目录，例如 `/teacher-profile/assets/`。
3. 将 `cms/teacher-profile-body.html` 中的资源路径改为实际上传路径，再把正文片段放入教师详情模板或对应页面。
4. 在预览栏目核对学校模板与教师正文衔接是否自然，并检查教师照片、分节标题和论文操作。
5. 导师确认个人信息与论文元数据后，再切换正式页面；旧页面至少保留一个发布周期用于回滚。

## 新增或修改论文

只编辑 `src/data/publications.json`。记录采用 CSL-JSON，扩展展示信息放在 `_faculty` 中：

- `category`：`journal` 或 `conference`；
- `labels`：SCI分区、CCF等级、EI或获奖信息；
- `corresponding`：通讯作者姓名数组；
- `searchTerms`：刊会简称等补充检索词，例如 `IJCAI`；
- `originalYear`：原主页登记年份，仅用于内容复核。

修改后运行：

```powershell
npm run verify
```

构建过程会校验必填字段和 DOI 链接格式，重新生成静态论文列表、筛选数据、CMS正文片段和浏览器引用工具。

## 上线前需导师确认的元数据差异

本版优先采用 DOI 返回的正式卷期信息，因此与原主页的“在线发表年份”存在几处差异：

- `Data augmentation...`、`GraphMV-SVAE`、`Synthesizing stronger nodes...`、`Efficient Channel Transformer...` 的正式卷期年份为2026，原页登记为2025。
- `Graph similarity learning for cross-level interactions` 的正式卷期年份为2025，原页登记为2024。
- `GraphDHV` 的会议为 COCOON 2024，但正式论文集出版年份为2025。
- IJCAI、TST、ICPR等个别条目的正式 DOI 作者列表比原主页更完整；`Graph Attention-Based...` 的 `Jiechen/Jiecheng Li` 拼写需导师最终确认。

这些差异已保存在结构化数据中，正式上线前应由导师逐项确认。
