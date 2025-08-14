// ===== 覆盖层 UI =====
let overlay: HTMLDivElement | null = null;
function ensureOverlay(): HTMLDivElement {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "__fps_overlay__";
  Object.assign(overlay.style, {
    position: "fixed",
    display: "none",
    top: "16px",
    right: "16px",
    zIndex: 2147483647,
    background: "rgba(0,0,0,0.65)",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: "12px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "12px",
    boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
    pointerEvents: "none",
    width: "220px",
  });
  overlay.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <div>Full Page Capture</div>
      <div id="__fps_pct__">0%</div>
    </div>
    <div style="height:8px;background:rgba(255,255,255,0.2);border-radius:999px;overflow:hidden;">
      <div id="__fps_bar__" style="height:100%;width:0%;background:#4ade80;"></div>
    </div>
    <div id="__fps_meta__" style="opacity:.85;margin-top:6px"></div>
  `;
  document.documentElement.appendChild(overlay);
  return overlay;
}

function setProgress(p: number, meta: string = ""): void {
  const pct = Math.round(p * 100);
  const bar = document.getElementById("__fps_bar__");
  const pctEl = document.getElementById("__fps_pct__");
  const metaEl = document.getElementById("__fps_meta__");
  if (bar) bar.style.width = pct + "%";
  if (pctEl) pctEl.textContent = pct + "%";
  if (metaEl) metaEl.textContent = meta;
}

// ===== 懒加载检测（视口内图片） =====
function isInViewport(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return (
    r.bottom > 0 &&
    r.right > 0 &&
    r.top < (window.innerHeight || document.documentElement.clientHeight) &&
    r.left < (window.innerWidth || document.documentElement.clientWidth)
  );
}

function imagesInViewport(): HTMLImageElement[] {
  return Array.from(document.images).filter((img) => isInViewport(img));
}

async function waitForLazyLoaded(timeoutMs: number = 2500): Promise<void> {
  const start = performance.now();
  let lastStable = performance.now();
  let lastCount = -1;

  while (performance.now() - start < timeoutMs) {
    const imgs = imagesInViewport();
    // 统计未加载完成的图片
    const pending = imgs.filter(
      (img) => !(img.complete && img.naturalWidth > 0)
    );
    if (pending.length === 0) {
      // 进入短暂稳定期（避免刚加载完马上截）
      if (performance.now() - lastStable > 150) return; // 稳定 150ms
      await new Promise((r) => requestAnimationFrame(r));
    } else {
      if (pending.length !== lastCount) {
        lastCount = pending.length;
        lastStable = performance.now();
      }
      // 监听其中任一 load/error，或小憩后重试
      await Promise.race([
        new Promise((r) => setTimeout(r, 120)),
        new Promise((r) =>
          pending[0].addEventListener("load", r as EventListener, {
            once: true,
          })
        ),
        new Promise((r) =>
          pending[0].addEventListener("error", r as EventListener, {
            once: true,
          })
        ),
      ]);
    }
  }
}

// ===== 在截图过程中隐藏随滚动的头部/侧栏（fixed/sticky） =====
type HiddenRecord = { el: HTMLElement; prevStyle: string | null };
type HideSession = { records: HiddenRecord[]; observers: MutationObserver[] };

function isFixedOrSticky(el: Element): boolean {
  try {
    const cs = getComputedStyle(el);
    if (!cs) return false;
    if (cs.display === "none" || parseFloat(cs.opacity || "1") === 0)
      return false;
    return cs.position === "fixed" || cs.position === "sticky";
  } catch {
    return false;
  }
}

function shouldSkip(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true;
  // 跳过我们自己的覆盖层及其子元素
  if (el.id === "__fps_overlay__" || el.closest("#__fps_overlay__"))
    return true;
  return false;
}

function hideFixedAndSticky(): HiddenRecord[] {
  const records: HiddenRecord[] = [];
  const all = document.body
    ? document.body.getElementsByTagName("*")
    : ([] as any);
  for (let i = 0; i < all.length; i++) {
    const el = all[i] as Element;
    if (shouldSkip(el)) continue;
    if (!isFixedOrSticky(el)) continue;
    const htmlEl = el as HTMLElement;
    const prev = htmlEl.getAttribute("style");
    // 强制隐藏但保持占位（不引发布局抖动）
    htmlEl.style.setProperty("visibility", "hidden", "important");
    htmlEl.style.setProperty("pointer-events", "none", "important");
    htmlEl.style.setProperty("animation", "none", "important");
    htmlEl.style.setProperty("transition", "none", "important");
    records.push({ el: htmlEl, prevStyle: prev });
  }
  return records;
}

function restoreHidden(records: HiddenRecord[]): void {
  for (const r of records) {
    if (!r.el.isConnected) continue;
    if (r.prevStyle === null) r.el.removeAttribute("style");
    else r.el.setAttribute("style", r.prevStyle);
  }
}

// 深度隐藏（shadow DOM + 同源 iframe）并监听新增节点
function hideFixedAndStickyDeep(): HideSession {
  const records: HiddenRecord[] = [];
  const observers: MutationObserver[] = [];

  const hideInRoot = (root: Document | ShadowRoot) => {
    const all =
      root instanceof Document && root.body
        ? root.body.getElementsByTagName("*")
        : (root as ParentNode).querySelectorAll?.("*") || ([] as any);
    for (let i = 0; i < (all as any).length; i++) {
      const el = (all as any)[i] as Element;
      if (shouldSkip(el)) continue;
      if (!isFixedOrSticky(el)) continue;
      const htmlEl = el as HTMLElement;
      const prev = htmlEl.getAttribute("style");
      htmlEl.style.setProperty("visibility", "hidden", "important");
      htmlEl.style.setProperty("pointer-events", "none", "important");
      htmlEl.style.setProperty("animation", "none", "important");
      htmlEl.style.setProperty("transition", "none", "important");
      records.push({ el: htmlEl, prevStyle: prev });
    }
  };

  const tryObserve = (root: Document | ShadowRoot) => {
    const ob = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => {
            if (!(n instanceof HTMLElement)) return;
            // 新增子树内也处理
            const stack: HTMLElement[] = [n];
            while (stack.length) {
              const cur = stack.pop()!;
              if (!shouldSkip(cur) && isFixedOrSticky(cur)) {
                const prev = cur.getAttribute("style");
                cur.style.setProperty("visibility", "hidden", "important");
                cur.style.setProperty("pointer-events", "none", "important");
                cur.style.setProperty("animation", "none", "important");
                cur.style.setProperty("transition", "none", "important");
                records.push({ el: cur, prevStyle: prev });
              }
              // 继续遍历子元素（仅 HTMLElement）
              if (cur.children && cur.children.length) {
                const arr = Array.from(cur.children).filter(
                  (c): c is HTMLElement => c instanceof HTMLElement
                );
                if (arr.length) stack.push(...arr);
              }
            }
          });
        } else if (m.type === "attributes") {
          if (!(m.target instanceof HTMLElement)) continue;
          const el = m.target as HTMLElement;
          if (shouldSkip(el)) continue;
          if (isFixedOrSticky(el)) {
            const prev = el.getAttribute("style");
            el.style.setProperty("visibility", "hidden", "important");
            el.style.setProperty("pointer-events", "none", "important");
            el.style.setProperty("animation", "none", "important");
            el.style.setProperty("transition", "none", "important");
            records.push({ el, prevStyle: prev });
          }
        }
      }
    });
    ob.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    observers.push(ob);
  };

  // 遍历顶层 document
  hideInRoot(document);
  tryObserve(document);

  // 遍历 shadow roots
  const els = document.querySelectorAll("*");
  els.forEach((el) => {
    const anyEl = el as any;
    if (anyEl.shadowRoot) {
      const root = anyEl.shadowRoot as ShadowRoot;
      hideInRoot(root);
      tryObserve(root);
    }
  });

  // 同源 iframes
  document.querySelectorAll("iframe").forEach((ifr) => {
    try {
      const doc = (ifr as HTMLIFrameElement).contentDocument;
      if (doc) {
        hideInRoot(doc);
        tryObserve(doc);
        // 其内部的 shadow DOM 也处理一层
        doc.querySelectorAll?.("*")?.forEach((el) => {
          const anyEl = el as any;
          if (anyEl.shadowRoot) {
            const root = anyEl.shadowRoot as ShadowRoot;
            hideInRoot(root);
            tryObserve(root);
          }
        });
      }
    } catch {}
  });

  return { records, observers };
}

function restoreHiddenDeep(session: HideSession): void {
  session.observers.forEach((ob) => ob.disconnect());
  restoreHidden(session.records);
}

// ===== 与 bg/offscreen 协作 =====
async function ensureOffscreen(): Promise<void> {
  await new Promise((resolve) => {
    chrome.runtime.sendMessage({ cmd: "ENSURE_OFFSCREEN" }, resolve);
  });
}

function sendToOffscreen<T = unknown>(payload: unknown): Promise<T> {
  return new Promise<T>((resolve) => {
    chrome.runtime.sendMessage(
      { cmd: "OFFSCREEN_MESSAGE", payload },
      resolve as (value?: unknown) => void
    );
  });
}

function captureViewport(): Promise<string | undefined> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { cmd: "CAPTURE_VIEWPORT" },
      (res: { dataUrl?: string } | undefined) => resolve(res?.dataUrl)
    );
  });
}

// ===== 截图时隐藏滚动条 =====
function applyHideScrollbars(scroller: HTMLElement): () => void {
  // 标记滚动容器，便于样式作用到特定容器
  const hadAttr = scroller.hasAttribute("data-fps-scroll");
  if (!hadAttr) scroller.setAttribute("data-fps-scroll", "1");

  const styleEl = document.createElement("style");
  styleEl.id = "__fps_scrollbar_hide__";
  styleEl.textContent = `
    /* Firefox 隐藏滚动条 */
    html, body, :root, [data-fps-scroll] { scrollbar-width: none !important; }
    /* WebKit 隐藏滚动条 */
    html::-webkit-scrollbar,
    body::-webkit-scrollbar,
    [data-fps-scroll]::-webkit-scrollbar,
    *::-webkit-scrollbar { width: 0 !important; height: 0 !important; background: transparent !important; }
  `;
  document.head?.appendChild(styleEl);

  return () => {
    styleEl.remove();
    if (!hadAttr) scroller.removeAttribute("data-fps-scroll");
  };
}

// ===== 根滚动容器自动检测（取最大 scrollHeight 的候选） =====
function getBestScroller(): HTMLElement {
  const defaults: HTMLElement[] = [];
  const se = (document.scrollingElement ||
    document.documentElement) as HTMLElement;
  if (se) defaults.push(se);
  if (document.documentElement)
    defaults.push(document.documentElement as HTMLElement);
  if (document.body) defaults.push(document.body as HTMLElement);

  const isScrollable = (el: HTMLElement): boolean => {
    const cs = getComputedStyle(el);
    if (!cs) return false;
    const oy = cs.overflowY;
    const scrollable = oy === "auto" || oy === "scroll" || oy === "overlay";
    return (
      scrollable && el.scrollHeight - el.clientHeight > 1 && el.clientHeight > 0
    );
  };
  const fillsViewport = (el: HTMLElement): boolean => {
    const r = el.getBoundingClientRect();
    return (
      r.width >= window.innerWidth * 0.9 &&
      r.height >= window.innerHeight * 0.7 &&
      r.top <= 0.5
    );
  };

  // 收集候选
  const candidates = new Set<HTMLElement>(defaults);
  const all = document.body
    ? document.body.getElementsByTagName("*")
    : ([] as any);
  const limit = Math.min(all.length, 5000); // 防止极端页面性能问题
  for (let i = 0; i < limit; i++) {
    const el = all[i] as Element;
    if (!(el instanceof HTMLElement)) continue;
    if (!isScrollable(el)) continue;
    if (!fillsViewport(el)) continue;
    candidates.add(el);
  }

  // 如果根滚动容器就是 window（document.scrollingElement）
  if (se && se.scrollHeight > window.innerHeight + 1) {
    return window.document.scrollingElement as HTMLElement;
  }

  // 选择 scrollHeight 最大的
  let best: HTMLElement | null = null;
  let bestH = -1;
  for (const el of candidates) {
    const h = el.scrollHeight || 0;
    if (h > bestH) {
      bestH = h;
      best = el;
    }
  }
  return best || se || (document.documentElement as HTMLElement);
}

// 是否正在运行中
let isRunning = false;
// ===== 主流程 =====
async function startCapture(): Promise<void> {
  ensureOverlay();

  const dpr = window.devicePixelRatio || 1;
  const scroller = getBestScroller();
  const cssViewportW = window.innerWidth; // 以可视宽度为导出宽度
  const cssViewportH = scroller.clientHeight; // 使用实际滚动容器的可视高度
  console.log(
    `Viewport: ${cssViewportW}x${cssViewportH}, scroller:`,
    scroller.tagName
  );

  // 页面总高度（CSS 像素）
  const cssTotalH = scroller.scrollHeight; // 以实际滚动容器的内容高度为准

  // 目标导出宽高（设备像素）
  const exportW = Math.round(cssViewportW * dpr);
  const exportH = Math.round(cssTotalH * dpr);

  // 步进（CSS 像素）。可以按视口整页步进；为了减少缝隙，建议无重叠。
  const stepCss = cssViewportH;
  const steps = Math.ceil(cssTotalH / stepCss);

  // 初始化 offscreen 的 PNG 编码任务
  await ensureOffscreen();
  await sendToOffscreen({ type: "PNG_INIT", width: exportW, height: exportH });

  // 在整个截图期间隐藏滚动条
  const restoreScrollbar = applyHideScrollbars(scroller);

  // 在隐藏之前：滚到顶部并捕获固定头/底覆盖层剪裁高度
  scroller.scrollTo({ top: 0, behavior: "auto" });
  await new Promise((r) => setTimeout(r, 100));
  // 估算顶部/底部固定条的 CSS 高度
  const allEls = Array.from(document.body?.getElementsByTagName("*") || []);
  let topCssH = 0;
  let bottomCssH = 0;
  for (const el of allEls) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.id === "__fps_overlay__" || el.closest("#__fps_overlay__")) continue;
    const cs = getComputedStyle(el);
    if (!cs) continue;
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    const r = el.getBoundingClientRect();
    // 顶部条：top 接近 0 或者黏在顶部
    const topVal = parseFloat(cs.top || "NaN");
    if (!Number.isNaN(topVal) && topVal <= 4) {
      topCssH = Math.max(
        topCssH,
        Math.max(0, Math.min(cssViewportH, r.bottom))
      );
      continue;
    }
    if (r.top <= 2) {
      topCssH = Math.max(
        topCssH,
        Math.max(0, Math.min(cssViewportH, r.bottom))
      );
      continue;
    }
    // 底部条：bottom 有值或靠近视口底部
    const bottomVal = parseFloat(cs.bottom || "NaN");
    if (!Number.isNaN(bottomVal) && bottomVal >= 0) {
      bottomCssH = Math.max(
        bottomCssH,
        Math.max(0, cssViewportH - Math.max(0, r.top))
      );
      continue;
    }
    if (r.bottom >= cssViewportH - 2) {
      bottomCssH = Math.max(
        bottomCssH,
        Math.max(0, cssViewportH - Math.max(0, r.top))
      );
      continue;
    }
  }
  // 限制最大不超过视口
  topCssH = Math.min(topCssH, cssViewportH);
  bottomCssH = Math.min(bottomCssH, cssViewportH);
  // 捕获顶部一帧并设置顶部覆盖层
  overlay && (overlay.style.display = "none");
  const overlayTopUrl = await captureViewport();
  overlay && (overlay.style.display = "block");
  const topPx = Math.round(topCssH * dpr);
  if (overlayTopUrl && topPx > 0) {
    await sendToOffscreen({
      type: "PNG_SET_OVERLAY",
      dataUrl: overlayTopUrl,
      topPx,
      viewportHeightPx: Math.round(cssViewportH * dpr),
    });
  }

  // // 若存在底部覆盖层：滚到底部截一帧并单独设置 bottom 覆盖层
  // if (bottomCssH > 0) {
  //   try {
  //     const bottomTarget = Math.max(0, cssTotalH - cssViewportH);
  //     scroller.scrollTo({ top: bottomTarget, behavior: "auto" });
  //     await new Promise((r) => setTimeout(r, 120));
  //     const overlayBottomUrl = await captureViewport();
  //     const bottomPx = Math.round(bottomCssH * dpr);
  //     if (overlayBottomUrl && bottomPx > 0) {
  //       await sendToOffscreen({
  //         type: "PNG_SET_OVERLAY",
  //         dataUrl: overlayBottomUrl,
  //         bottomPx,
  //         viewportHeightPx: Math.round(cssViewportH * dpr),
  //       });
  //     }
  //   } finally {
  //     // 回到顶部准备正式截取
  //     scroller.scrollTo({ top: 0, behavior: "auto" });
  //     await new Promise((r) => setTimeout(r, 100));
  //   }
  // }

  // 隐藏固定/粘性元素
  const hiddenSession = hideFixedAndStickyDeep();

  try {
    // 从顶部开始
    // behavior: "instant" 不是标准值，用 "auto" 兼容类型
    scroller.scrollTo({ top: 0, behavior: "auto" });
    await new Promise((r) => setTimeout(r, 100));

    let writtenRows = 0; // 已写入的导出像素行数（设备像素）

    for (let i = 0; i < steps; i++) {
      const targetCssY = i * stepCss;

      // 平滑滚动
      await new Promise<void>((resolve) => {
        const onScroll = (): void => {
          if (Math.abs(scroller.scrollTop - targetCssY) < 2) {
            scroller.removeEventListener("scroll", onScroll);
            resolve();
          }
        };
        scroller.addEventListener("scroll", onScroll);
        scroller.scrollTo({ top: targetCssY, behavior: "smooth" });
        // 最长 650ms 兜底
        setTimeout(() => {
          scroller.removeEventListener("scroll", onScroll);
          resolve();
        }, 650);
      });

      // 等待懒加载资源稳定
      await waitForLazyLoaded(2500);
      // 截图视口
      // 截图前先隐藏进度条
      overlay && (overlay.style.display = "none");
      const dataUrl = await captureViewport();
      overlay && (overlay.style.display = "block");

      // 本块目标累计行（避免舍入误差）
      const targetCss = Math.min(cssTotalH, (i + 1) * stepCss);
      const targetRowsPx = Math.round(targetCss * dpr);
      let thisDeviceRows = Math.max(0, targetRowsPx - writtenRows);

      // 若是最后一块，可能与前一帧重叠：计算当前视口内应该从哪一行开始截取
      let startRow = 0;
      const viewportRows = Math.round(cssViewportH * dpr);
      if (i === steps - 1) {
        // 已写入的像素 vs 最后一屏顶部在最终图的位置
        const finalTopAt = exportH - viewportRows; // 最后一屏顶端对应的总图位置
        if (writtenRows > finalTopAt) {
          // 已经写过最后一屏的一部分，计算重叠行数
          startRow = Math.min(viewportRows - 1, writtenRows - finalTopAt);
          thisDeviceRows = Math.max(0, viewportRows - startRow);
        }
      }

      // 传给 offscreen：仅追加新增部分，并从 startRow 开始
      await sendToOffscreen({
        type: "PNG_APPEND_TILE",
        dataUrl,
        rows: thisDeviceRows,
        startRow,
        expectedWidth: exportW,
      });
      console.log(
        "tile rows=",
        thisDeviceRows,
        "startRow=",
        startRow,
        "w=",
        exportW
      );

      writtenRows += thisDeviceRows;
      setProgress(
        writtenRows / exportH,
        `${i + 1}/${steps}  rows: ${writtenRows}/${exportH}`
      );
    }

    // 完成并下载
    let result: any = await sendToOffscreen({
      type: "PNG_FINALIZE",
      filename: `fullpage-${Date.now()}.png`,
    });
    chrome.runtime.sendMessage({ cmd: "DOWNLOAD", ...result });
    setProgress(1, "done");

    // 收尾（自动隐藏覆盖层）
    setTimeout(() => {
      overlay?.remove();
      overlay = null;
    }, 1200);
  } finally {
    // 运行成功
    isRunning = false;
    // 恢复被隐藏的元素
    restoreHiddenDeep(hiddenSession);
    // 恢复滚动条显示
    try {
      restoreScrollbar();
    } catch {}
  }
}

// 消息入口
chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
  if (msg?.type === "START_CAPTURE") {
    if (!isRunning) {
      isRunning = true;
      void startCapture().catch(console.error);
    }
  }
});
