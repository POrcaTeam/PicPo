// 版权所有 © 2014-2023 Joe Ertaba，遵循 Mozilla Public License 2.0 协议
// 插件主页：https://webextension.org/listing/save-images.html
// GitHub：https://github.com/belaviyo/save-images/

"use strict";

import { post } from "./utils/port";

/**
 * 全局采集器对象
 */
var collector = {
  active: true, // 是否启用采集器
  feeds: {
    // 分类收集的链接：
    // 1：图片；2：同源资源（但不是图片）；3：其它链接
    "1": [],
    "2": [],
    "3": [],
  },
  "processed-images": [], // 已经确认并处理的图片
  "raw-images": [], // 等待获取尺寸、类型等信息的图片
  docs: [], // 等待进一步解析的 HTML 文档
  cache: new Set(), // 用于去重，记录已处理的 URL
};

/**
 * 报告采集进度
 */
var report = () => {
  post({
    cmd: "progress",
    value:
      collector.feeds["1"].length +
      collector.feeds["2"].length +
      collector.feeds["3"].length +
      collector["raw-images"].length +
      collector.docs.length,
  });
};

/**
 * 事件处理器（当采集到新的资源时触发）
 */
collector.events = {
  image(o) {
    post({ cmd: "images", images: [o] });
  },
  feed(length) {
    post({
      cmd: "links",
      filters: (window.regexp || []).length,
      length,
    });
  },
  document() {
    report(); // 触发文档相关更新
  },
  validate() {
    report(); // 验证阶段完成时汇报进度
  },
  raw() {
    report(); // 原始图像处理时更新
  },
};

/**
 * 尝试快速识别图片的类型
 */
collector.meta = async function (o) {
  let im;

  // 根据扩展名或 MIME 类型初步猜测图片类型
  for (const [ext, type] of Object.entries(utils.EXTENSIONS)) {
    if (
      o.src.toLowerCase().endsWith("." + ext) ||
      (o.width && o.src.toLowerCase().includes("." + ext)) ||
      o.src.toLowerCase().includes("." + ext + "?") ||
      o.src.startsWith("data:image/" + ext)
    ) {
      im = {
        meta: { type },
        origin: "guess", // 类型是猜测得来的
      };
      break;
    }
  }

  // 判断是否跳过远程请求
  const conds = [
    (window.accuracy === "accurate" ||
      window.accuracy === "partial-accurate") &&
      !o.width,
    window.accuracy !== "accurate" || o.size,
  ];
  if (im && conds.some(Boolean)) return im;

  // 如果需要更精确的 meta，则发起 HEAD 请求
  try {
    const meta = await utils.response.heads(o);
    meta.type = utils.type(im?.meta, meta);

    if (o.verified && !meta.type) {
      meta.type = "image/unknown";
    }

    return { meta, origin: "bg.fetch" };
  } catch (e) {
    console.warn(e);
  }

  return {};
};

/**
 * 递归收集 Shadow DOM 的根节点
 */
collector.findRoots = function (doc, list = []) {
  for (const e of doc.querySelectorAll("*")) {
    if (e.shadowRoot) {
      try {
        collector.findRoots(e.shadowRoot, list);
        list.push(e.shadowRoot);
      } catch (e) {}
    }
  }
};

/**
 * 分析页面中所有可疑图片资源（核心）
 */
collector.inspect = function (doc, loc, name, policies) {
  const docs = [doc];
  collector.findRoots(doc, docs); // 包含 shadowRoot 的文档

  // 以下是四大类图像采集方式：

  // ==== Part 1: <img> 图片 ====
  for (const doc of docs) {
    const images = doc.images || doc.querySelectorAll("img");
    for (const img of [...images]) {
      collector.push({
        width: img.naturalWidth,
        height: img.naturalHeight,
        src: img.currentSrc || img.src || img.dataset.src,
        alt: img.alt,
        custom: img.getAttribute(window.custom) || "",
        verified: window.accuracy === "accurate" ? false : true,
        page: loc.href,
        meta: {
          origin: name + " - document.images",
          size: "img.element",
          type: "skipped",
        },
      });

      // 有时 currentSrc 和 src 不同，分别处理
      if (img.src && img.currentSrc !== img.src) {
        collector.push({
          src: img.src,
          alt: img.alt,
          custom: img.getAttribute(window.custom) || "",
          verified: window.accuracy === "accurate" ? false : true,
          page: loc.href,
          meta: {
            origin: name + " - document.images",
            size: "img.element",
            type: "skipped",
          },
        });
      }
    }
  }

  // ==== Part 2: <source> 标签 ====
  for (const doc of docs) {
    for (const source of doc.querySelectorAll("source")) {
      if (source.srcset) {
        collector.push({
          src: source.srcset.split(" ")[0],
          type: source.type,
          page: loc.href,
          meta: {
            origin: name + " - source.element",
          },
        });
      }
    }
  }

  // ==== Part 3: SVG 图像 ====
  for (const doc of docs) {
    for (const svg of doc.querySelectorAll("svg")) {
      const e = svg.cloneNode(true);
      e.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      collector.push({
        src:
          "data:image/svg+xml;charset=utf-8," + encodeURIComponent(e.outerHTML),
        type: "image/svg+xml",
        page: loc.href,
        meta: {
          origin: name + " - svg.query",
        },
      });
    }
  }

  // ==== Part 4: performance 资源 ====
  for (const doc of docs) {
    try {
      for (const entry of doc.defaultView.performance.getEntriesByType(
        "resource"
      )) {
        if (entry.initiatorType === "css") {
          if (entry.name.includes(".ttf") || entry.name.includes(".woff"))
            continue;

          collector.push({
            src: entry.name,
            type: "",
            page: loc.href,
            meta: {
              origin: name + " - css.performance",
            },
          });
        } else if (entry.initiatorType === "img") {
          collector.push({
            src: entry.name,
            type: "image/unknown",
            verified: true,
            page: loc.href,
            meta: {
              origin: name + " - img.performance",
            },
          });
        }
      }
    } catch (e) {}
  }

  // ==== 嵌入在 SVG <image> 的图片 ====
  for (const doc of docs) {
    for (const image of doc.querySelectorAll("image")) {
      collector.push({
        src: image.href?.baseVal,
        alt: image.alt,
        custom: image.getAttribute(window.custom) || "",
        verified: window.accuracy === "accurate" ? false : true,
        page: loc.href,
        meta: {
          origin: name + " - svg.images",
          size: "img.element",
          type: "skipped",
        },
      });
    }
  }

  // ==== 背景图像 ====
  if (policies.bg) {
    for (const doc of docs) {
      try {
        [...doc.querySelectorAll("*")]
          .flatMap((e) => [
            getComputedStyle(e).backgroundImage,
            getComputedStyle(e, ":before").backgroundImage,
            getComputedStyle(e, ":after").backgroundImage,
          ])
          .filter((s) => s && s.includes("url("))
          .flatMap((s) => extract(s))
          .filter(Boolean)
          .forEach((src) => {
            collector.push({
              src,
              page: loc.href,
              meta: { origin: name + " - link" },
            });
          });
      } catch (e) {
        console.warn("无法获取背景图", e);
      }
    }
  }

  // ==== 提取 a.href 链接 ====
  if (window.deep > 0 && policies.links) {
    for (const doc of docs) {
      [...doc.querySelectorAll("a")]
        .map((a) => a.href)
        .forEach((src) =>
          collector.push({
            src,
            page: loc.href,
            meta: { origin: name + " - link.href" },
          })
        );
    }
  }

  // ==== 正则提取网页源码中硬编码的链接 ====
  if (window.deep > 0 && policies.extract) {
    for (const doc of docs) {
      const content =
        (doc.documentElement?.innerHTML || "") + "\n\n" + doc.textContent;

      extract(content)
        .map(
          (s) =>
            s
              .replace(/&amp;/g, "&")
              .replace(/&quot;/g, '"')
              .replace(/\\+$/, "")
              .split(/['")]/)[0]
              .split("</")[0]
        )
        .forEach((src) => {
          collector.push({
            src,
            page: loc.href,
            meta: {
              origin: name + " - regex.hard-coded.link",
            },
          });
        });
    }
  }
};

/**
 * 添加资源并分类入 feeds
 */
collector.push = function (o) {
  if (o.src) {
    // 如果设置了过滤规则（window.regexp），且不匹配则跳过
    if (window.regexp && window.regexp.some((r) => r.test(o.src)) === false)
      return;

    o.position = collector.position++;

    try {
      const loc = new URL(o.src, o.page);

      if (
        !["http:", "https:", "file:", "data:", "blob:"].includes(loc.protocol)
      )
        return;

      o.src = loc.href;

      if (!collector.cache.has(o.src)) {
        collector.cache.add(o.src);

        if (o.width) {
          collector.feeds["1"].push(o);
        } else if (
          ["bmp", "png", "gif", "webp", "jpg", "svg", "ico"].some(
            (ext) =>
              o.src.includes("." + ext) || o.src.startsWith("data:image/" + ext)
          )
        ) {
          collector.feeds["1"].push(o);
        } else if (loc.origin === location.origin) {
          collector.feeds["2"].push(o);
        } else {
          collector.feeds["3"].push(o);
        }

        collector.events.feed(1);
      }
    } catch (e) {
      console.warn("无效URL", o);
    }
  }
};
collector.position = 0;

/**
 * 添加处理后的图像（含尺寸、类型）
 */
collector.addImage = function (o) {
  if (
    (window.accuracy === "accurate" ||
      window.accuracy === "partial-accurate") &&
    !o.width
  ) {
    collector["raw-images"].push(o);
    collector.head();
    return;
  }

  if (!o.type.startsWith("image/")) {
    collector["raw-images"].push(o);
    collector.head();
    return;
  }

  collector["processed-images"].push(o);
  collector.events.image(o);
};

/**
 * 获取图片宽高（或fallback用 <img> 加载）
 */
collector.head = async function () {
  if (collector.head.jobs > 5 || !collector.active) return;

  const prefs = await new Promise((resolve) =>
    chrome.storage.local.get(
      {
        "head-timeout": 30000,
        "head-delay": 100,
      },
      resolve
    )
  );

  const o = collector["raw-images"].shift();
  if (o) {
    collector.head.jobs++;

    try {
      const r = await utils.response.segment(o);

      o.size = r.size;
      o.type = utils.type(o, r);
      o.disposition = r.disposition;

      for (const name of ["bmp", "png", "gif", "webp", "jpg"]) {
        if (type[name](r.segment)) {
          const meta = size[name](r.segment);
          if (meta) {
            Object.assign(o, meta);
            o.meta.size = "size.js";
            break;
          }
        }
      }

      if (!o.width) throw Error("检测失败");
    } catch (e) {
      if (e.message === "STATUS_CODE_403") {
        post({ cmd: "alternative-image-may-work" });
      }

      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          o.width = img.naturalWidth;
          o.height = img.naturalHeight;
          o.type = utils.type(o, { type: "image/unknown" });
          o.meta.size = "size.img.element";
          resolve();
        };
        img.onerror = () => {
          o.meta.size = "error";
          resolve();
        };
        img.src = o.src;
      });
    }

    if (o.type.startsWith("image/")) {
      collector["processed-images"].push(o);
      collector.events.image(o);
    }

    setTimeout(() => {
      collector.head.jobs--;
      collector.events.raw();
      collector.head();
    }, prefs["head-delay"]);
  }
};
collector.head.jobs = 0;

/**
 * 验证资源类型，图片 or 文档
 */
collector.validate = async function () {
  if (collector.validate.jobs > 5 || !collector.active) return;

  const o = collector.feeds["1"].length
    ? collector.feeds["1"].shift()
    : collector.feeds["2"].length
    ? collector.feeds["2"].shift()
    : collector.feeds["3"].shift();

  let rm = false;
  if (o) {
    collector.validate.jobs++;

    try {
      const { meta, origin } = await collector.meta(o);
      Object.assign(o, meta);
      o.meta.type = origin;

      if (o.type?.startsWith("image/") || o.type?.startsWith("application/")) {
        collector.addImage(o);
      } else if (o.type?.startsWith("text/html")) {
        collector.document(o);
        rm = true;
      }
    } catch (e) {
      console.warn("无法验证", o, e);
    }

    const done = () => {
      collector.validate.jobs--;
      collector.events.validate();
      collector.validate();
    };

    chrome.storage.local.get(
      {
        "validate-delay": 100,
      },
      (prefs) => setTimeout(done, rm ? prefs["validate-delay"] : 0)
    );
  }
};
collector.validate.jobs = 0;

/**
 * 收集到 HTML 文档（如 iframe）后进一步深入分析
 */
collector.document = function (o) {
  if (!collector.active) return;

  if (window.deep > 1 && o.meta.origin.startsWith("one")) {
    collector.docs.push(o);
    collector.dig();
    collector.dig();
    collector.dig();
  }
};

/**
 * 深入分析子文档（HTML 内容）
 */
collector.dig = async function () {
  if (collector.dig.jobs > 5 || !collector.active) return;

  const prefs = await new Promise((resolve) =>
    chrome.storage.local.get(
      {
        "dig-delay": 100,
        "dig-timeout": 30000,
      },
      resolve
    )
  );

  const o = collector.docs.shift();
  if (o?.src) {
    collector.dig.jobs++;

    try {
      const content = await utils.response.text(o);
      if (content) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "text/html");
        const base = doc.createElement("base");
        base.href = o.src;
        doc.head.appendChild(base);

        post({ cmd: "new-frame" });

        collector.inspect(doc, new URL(o.src), "two", {
          bg: window.deep === 3,
          links: window.deep === 3,
          extract: window.deep === 3,
        });

        collector.validate();
        collector.validate();
        collector.validate();
      }
    } catch (e) {}

    setTimeout(() => {
      collector.dig.jobs--;
      collector.events.document();
      collector.dig();
    }, prefs["dig-delay"]);
  }
};
collector.dig.jobs = 0;

/**
 * 启动入口（调用后开始运行采集任务）
 */
collector.loop = function () {
  collector.inspect(document, location, "one", {
    bg: true,
    links: true,
    extract: true,
  });

  collector.validate();
  collector.validate();
  collector.validate();
};
