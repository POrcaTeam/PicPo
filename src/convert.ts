import { extractUrls, Utils } from "./utils/utils";

declare global {
  interface Window {
    collector: Collector;
    post: (request: any) => void;
  }
}
// 因为content创建时间早于popup初始化，所以这里不能直接加载
// import { post } from "./utils/port";
// 我们尝试去加载一个空方法
const testPost = (request: any) => {
  // 验证 window 是否包含post方法
  // 如果包含执行window方法，如果不包括保证代码不报错执行空方法
  if (typeof window.post === "function") {
    (window as any).post(request);
  }
};

/**
 * 网页数据采集器
 * 其中包含如下重点属性
 * processed-images：已验证并处理的图片数组。
 * raw-images：待获取尺寸和类型的原始图片数组。
 * docs：待解析的 HTML 子文档数组。
 * cache：Set 对象，用于记录已处理的 URL，避免重复。
 *
 * [1] 收集资源
 * inspect 是资源收集的核心函数，分析指定文档（主文档或子文档）中的各种资源。它支持以下采集方式：
 * - <img> 标签：提取图片的 src、alt、尺寸等信息。
 * - <source> 标签：从 <picture> 元素的 <source> 中提取 srcset。
 * - SVG 图像：克隆 SVG 元素并生成 data:image/svg+xml 格式的 URL。
 * - 性能资源（webkit内核具备）：通过 performance.getEntriesByType("resource") 获取页面加载的资源（如图片和 CSS 文件）。
 * - SVG <image> 元素：提取 SVG 中的嵌入图片。
 * - 背景图片：若启用（policies.bg），提取 CSS background-image 中的 URL。
 * - <a> 标签链接：若深度大于 0（window.deep > 0），提取锚点链接。
 * - 硬编码链接：使用正则表达式从页面源码中提取 URL。
 * 每次发现资源时，调用 collector.push 将其分类到 feeds 中。
 *
 * [2] 资源分类：
 * push 函数根据资源类型和来源，将其加入适当的 feeds 数组：如果资源有尺寸（width）或 URL 包含图片扩展名（如 .png、.jpg），放入 feeds["1"]。
 * 如果资源来自同源但不是图片，放入 feeds["2"]。
 * 其他情况放入 feeds["3"]。
 * 使用 cache 去重，并支持正则表达式过滤（window.regexp）。
 *
 * [3] 图片处理
 * addImage：处理图片资源。如果需要高精度（window.accuracy 为 "accurate" 或 "partial-accurate"）且缺少尺寸，或类型未确认，则将图片加入 raw-images 等待进一步处理。
 * head：从 raw-images 中取出图片，获取其元数据：尝试通过二进制数据分析尺寸和类型（如 PNG、JPG）。
 * 若失败，加载 <img> 元素以获取尺寸。
 * 处理完成后，将图片加入 processed-images 并触发 image 事件。
 * 并发限制为 5 个任务（head.jobs）。
 *
 * [4] 类型验证
 * validate 函数从 feeds 中取出资源，调用 collector.meta 检查其类型：如果是图片（image/*），调用 addImage 处理。
 * 如果是 HTML 文档（text/html），调用 collector.document 加入 docs。
 * 并发限制为 5 个任务（validate.jobs）。
 *
 * [5] 子文档解析
 * document：当发现 HTML 子文档（如 iframe）且深度大于 1（window.deep > 1）时，加入 docs 数组。
 * dig：从 docs 中取出文档，获取其内容，解析为 DOM，然后调用 inspect 继续收集资源。并发限制为 5 个任务（dig.jobs）。
 */
export class Collector {
  // 是否启用采集器
  private active = true;
  // 分类收集的链接：
  // 1：图片；2：同源资源（但不是图片）；3：其它链接
  private feeds = {
    1: [] as ImageEntry[],
    2: [] as ImageEntry[],
    3: [] as ImageEntry[],
  };
  // 等待获取尺寸、类型等信息的图片
  private rawImages: ImageEntry[] = [];
  // 已经确认并处理的图片
  private processedImages: ImageEntry[] = [];
  // 等待进一步解析的 HTML 文档
  private docs: DocumentEntry[] = [];
  // 用于去重，记录已处理的 URL
  private cache = new Set<string>();
  private position = 0;

  // 待完成的任务数量
  private headJobs = 0;
  private validateJobs = 0;
  private digJobs = 0;

  constructor(
    private regexp: RegExp[] = [], // 正则表达式
    private deep: number = 2, // 检索深度
    private customAttr: string = ""
  ) {}

  /**
   * 启动入口（调用后开始运行采集任务）
   */
  public loop() {
    // 开始采集图片
    this.inspect(document, location, "one", {
      bg: true, // 采集背景图片
      links: true, // 采集 <a> 链接
      extract: true, // 采集硬编码链接
    });

    // 启动5个线程验证数据
    for (let i = 0; i <= 5; i++) this.validate();
    return this;
  }

  // 反馈当前进度
  private report() {
    testPost({
      cmd: "progress",
      value:
        this.feeds[1].length +
        this.feeds[2].length +
        this.feeds[3].length +
        this.rawImages.length +
        this.docs.length,
    });
  }

  private findRoots(
    doc: Document | ShadowRoot,
    list: (Document | ShadowRoot)[] = []
  ) {
    for (const e of doc.querySelectorAll("*")) {
      if ((e as HTMLElement).shadowRoot) {
        try {
          this.findRoots((e as HTMLElement).shadowRoot!, list);
          list.push((e as HTMLElement).shadowRoot!);
        } catch {}
      }
    }
  }

  // 将资源添加到feeds中
  private push(o: ImageEntry) {
    if (!o.src) return;
    // 如果配置正则验证路径是否匹配正则规则
    if (this.regexp.length && this.regexp.some((r) => !r.test(o.src))) return;

    o.position = this.position++;
    try {
      const loc = new URL(o.src, o.page);
      if (
        !["http:", "https:", "file:", "data:", "blob:"].includes(loc.protocol)
      )
        return;

      o.src = loc.href;
      if (!this.cache.has(o.src)) {
        this.cache.add(o.src);

        if (
          o.width ||
          ["bmp", "png", "gif", "webp", "jpg", "svg", "ico"].some((n) =>
            o.src.includes("." + n)
          )
        ) {
          this.feeds[1].push(o);
        } else if (loc.origin === location.origin) {
          this.feeds[2].push(o);
        } else {
          this.feeds[3].push(o);
        }

        testPost({ cmd: "links", filters: this.regexp.length, length: 1 });
      }
    } catch (e) {
      console.warn("invalid URL", o);
    }
  }

  private async meta(o: ImageEntry): Promise<MetaResult | {}> {
    let im: MetaResult | undefined;
    for (const [ext, type] of Object.entries(Utils.EXTENSIONS)) {
      if (
        o.src.toLowerCase().endsWith("." + ext) ||
        (o.width && o.src.toLowerCase().includes("." + ext)) ||
        o.src.toLowerCase().includes("." + ext + "?") ||
        o.src.startsWith("data:image/" + ext)
      ) {
        im = { meta: { type }, origin: "guess" };
        break;
      }
    }

    const accuracy = (window as any).accuracy;
    const conds = [
      (accuracy === "accurate" || accuracy === "partial-accurate") && !o.width,
      accuracy !== "accurate" || o.size,
    ];
    if (im && conds.some(Boolean)) return im;

    try {
      const meta: any = await Utils.responseHeads(o);
      meta.type = Utils.type(im?.meta as any, meta);
      if (o.verified && !meta.type) meta.type = "image/unknown";
      return { meta, origin: "bg.fetch" };
    } catch (e) {
      console.warn(e);
    }
    return {};
  }

  private async validate() {
    if (this.validateJobs > 5 || !this.active) return;

    const o =
      this.feeds[1].shift() || this.feeds[2].shift() || this.feeds[3].shift();
    if (!o) return;

    this.validateJobs++;
    let rm = false;
    try {
      const res = await this.meta(o);
      if ("meta" in res && res.meta) {
        Object.assign(o, res.meta);
        o.meta.type = res.origin;

        if (
          o.type?.startsWith("image/") ||
          o.type?.startsWith("application/")
        ) {
          this.addImage(o);
        } else if (o.type?.startsWith("text/html")) {
          this.docs.push(o);
          for (let i = 0; i < 5; i++) this.dig();
          rm = true;
        }
      }
    } catch (e) {
      console.warn("validate error", e);
    }

    setTimeout(
      () => {
        this.validateJobs--;
        this.report();
        this.validate();
      },
      rm ? 100 : 0
    );
  }

  private addImage(o: ImageEntry) {
    const accuracy = (window as any).accuracy;
    if (
      (accuracy === "accurate" || accuracy === "partial-accurate") &&
      !o.width
    ) {
      this.rawImages.push(o);
      this.head();
      return;
    }
    if (!o.type?.startsWith("image/")) {
      this.rawImages.push(o);
      this.head();
      return;
    }
    this.processedImages.push(o);
    console.log({ cmd: "images", images: [o] });
    testPost({ cmd: "images", images: [o] });
  }

  private async head() {
    if (this.headJobs > 5 || !this.active) return;

    const o = this.rawImages.shift();
    if (!o) return;

    this.headJobs++;
    try {
      const r = await Utils.responseSegment(o);
      o.size = r.size;
      o.type = Utils.type(o, r);
      o.disposition = r.disposition;
      // TODO: image width/height detection
    } catch (e) {
      // fallback to loading image
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          o.width = img.naturalWidth;
          o.height = img.naturalHeight;
          o.type = Utils.type(o, { type: "image/unknown" });
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

    if (o.type?.startsWith("image/")) {
      this.processedImages.push(o);
      testPost({ cmd: "images", images: [o] });
    }

    setTimeout(() => {
      this.headJobs--;
      this.report();
      this.head();
    }, 100);
  }

  private async dig() {
    if (this.digJobs > 5 || !this.active) return;

    const o = this.docs.shift();
    if (!o?.src) return;

    this.digJobs++;
    try {
      const html = await Utils.responseText(o);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const base = doc.createElement("base");
      base.href = o.src;
      doc.head.appendChild(base);

      testPost({ cmd: "new-frame" });
      this.inspect(doc, new URL(o.src), "two", {
        bg: this.deep === 3,
        links: this.deep === 3,
        extract: this.deep === 3,
      });

      for (let i = 0; i < 5; i++) this.validate();
    } catch {}

    setTimeout(() => {
      this.digJobs--;
      this.report();
      this.dig();
    }, 100);
  }

  /**
   * 分析页面中的图片资源
   * @param doc
   * @param loc
   * @param name
   * @param policies 分析策略
   */
  public inspect(
    doc: Document,
    loc: Location | URL,
    name: string,
    policies: Policies,
    options: {
      // 确认mime类型并从服务器猜测文件名
      accuracy?: "accurate" | "partial-accurate" | "no-accurate";
      customAttr?: string;
    } = {
      accuracy: "accurate", // 默认使用部分准确的方式
      customAttr: "", // 自定义属性名
    }
  ) {
    // 读取参数
    const { accuracy, customAttr } = options;

    const docs: (Document | ShadowRoot)[] = [doc];
    this.findRoots(doc, docs);

    for (const d of docs) {
      // part 1: <img> 图片检索
      for (const img of Array.from(d.querySelectorAll("img"))) {
        const src =
          (img as HTMLImageElement).currentSrc ||
          img.src ||
          (img as any).dataset?.src;
        if (!src) continue;

        this.push({
          width: img.naturalWidth,
          height: img.naturalHeight,
          src,
          alt: img.alt,
          custom: img.getAttribute(this.customAttr) || "",
          // 验证文件格式?
          verified: accuracy === "accurate" ? false : true,
          page: loc.href,
          meta: {
            origin: `${name} - document.images`,
            size: "img.element",
            type: "skipped",
          },
        });

        if (img.src && img.currentSrc !== img.src) {
          this.push({
            src: img.src,
            alt: img.alt,
            custom: img.getAttribute(this.customAttr) || "",
            verified: accuracy === "accurate" ? false : true,
            page: loc.href,
            meta: {
              origin: `${name} - document.images`,
              size: "img.element",
              type: "skipped",
            },
          });
        }
      }

      // part 2: <source> 标签
      for (const source of Array.from(d.querySelectorAll("source"))) {
        if (source.srcset) {
          this.push({
            src: source.srcset.split(" ")[0],
            type: source.type,
            page: loc.href,
            meta: { origin: `${name} - source.element` },
          });
        }
      }

      // part 3: <svg> 图像
      for (const svg of Array.from(d.querySelectorAll("svg"))) {
        const clone = svg.cloneNode(true) as SVGElement;
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        this.push({
          src:
            "data:image/svg+xml;charset=utf-8," +
            encodeURIComponent(clone.outerHTML),
          type: "image/svg+xml",
          page: loc.href,
          meta: { origin: `${name} - svg.query` },
        });
      }

      // part 4: performance.getEntriesByType('resource')
      try {
        for (const entry of (
          d as Document
        ).defaultView?.performance?.getEntriesByType("resource") || []) {
          if ((entry as PerformanceResourceTiming).initiatorType === "css") {
            if (entry.name.includes(".ttf") || entry.name.includes(".woff"))
              continue;
            this.push({
              src: entry.name,
              type: "",
              page: loc.href,
              meta: { origin: `${name} - css.performance` },
            });
          } else if (
            (entry as PerformanceResourceTiming).initiatorType === "img"
          ) {
            this.push({
              src: entry.name,
              type: "image/unknown",
              verified: true,
              page: loc.href,
              meta: { origin: `${name} - img.performance` },
            });
          }
        }
      } catch {}

      // part 4: background images via getComputedStyle
      if (policies.bg) {
        for (const el of Array.from(d.querySelectorAll("*"))) {
          const styles = [
            getComputedStyle(el).backgroundImage,
            getComputedStyle(el, ":before").backgroundImage,
            getComputedStyle(el, ":after").backgroundImage,
          ];
          styles
            .filter((s) => s && s.includes("url("))
            .flatMap((s) => extractUrls(s))
            .forEach((src) => {
              this.push({
                src,
                page: loc.href,
                meta: { origin: `${name} - background.image` },
              });
            });
        }
      }

      // part 5: <image> inside <svg>
      for (const img of Array.from(d.querySelectorAll("image"))) {
        const src = (img as any).href?.baseVal;
        if (src) {
          this.push({
            src,
            alt: (img as any).alt,
            custom: img.getAttribute(this.customAttr) || "",
            verified: accuracy === "accurate" ? false : true,
            page: loc.href,
            meta: {
              origin: `${name} - svg.images`,
              size: "img.element",
              type: "skipped",
            },
          });
        }
      }

      // part 6: links
      if (this.deep > 0 && policies.links) {
        for (const a of Array.from(d.querySelectorAll("a"))) {
          this.push({
            src: a.href,
            page: loc.href,
            meta: { origin: `${name} - link.href` },
          });
        }
      }

      // part 7: hard-coded urls from html/text content
      if (this.deep > 0 && policies.extract) {
        const content =
          (d as Document).documentElement?.innerHTML + "\n\n" + d.textContent;
        extractUrls(content)
          .map(
            (s) =>
              s
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"')
                .replace(/\\+$/, "")
                .split(/["')]/)[0]
                .split("</")[0]
          )
          .forEach((src) => {
            this.push({
              src,
              page: loc.href,
              meta: { origin: `${name} - regex.hard-coded.link` },
            });
          });
      }
    }
  }
}
