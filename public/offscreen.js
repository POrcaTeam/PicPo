// Offscreen PNG 流式编码器
(() => {
  "use strict";

  // ===== CRC32 =====
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  const crc32Seed = () => 0xffffffff;
  const crc32Update = (crc, data) => {
    let c = crc >>> 0;
    for (let i = 0; i < data.length; i++) {
      c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    }
    return c >>> 0;
  };
  const crc32Final = (crc) => (crc ^ 0xffffffff) >>> 0;

  // ===== Adler-32 (zlib) =====
  const MOD_ADLER = 65521;
  const adler32Update = (a, b, data) => {
    for (let i = 0; i < data.length; i++) {
      a += data[i];
      b += a;
      if (a >= MOD_ADLER) a -= MOD_ADLER;
      if (b >= MOD_ADLER) b %= MOD_ADLER;
    }
    return [a, b];
  };

  // ===== Utils =====
  const u32be = (n) => {
    const b = new Uint8Array(4);
    b[0] = (n >>> 24) & 0xff;
    b[1] = (n >>> 16) & 0xff;
    b[2] = (n >>> 8) & 0xff;
    b[3] = n & 0xff;
    return b;
  };

  const chunk = (typeStr, data) => {
    const type = new TextEncoder().encode(typeStr);
    const len = u32be(data.length);
    let crc = crc32Seed();
    crc = crc32Update(crc, type);
    crc = crc32Update(crc, data);
    crc = crc32Final(crc);
    const crcBytes = u32be(crc);
    const out = new Uint8Array(4 + 4 + data.length + 4);
    out.set(len, 0);
    out.set(type, 4);
    out.set(data, 8);
    out.set(crcBytes, 8 + data.length);
    return out;
  };

  const pngSignature = () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const makeIHDR = (width, height) => {
    const d = new Uint8Array(13);
    d.set(u32be(width), 0);
    d.set(u32be(height), 4);
    d[8] = 8; // bit depth
    d[9] = 6; // color type RGBA
    d[10] = 0; // compression
    d[11] = 0; // filter
    d[12] = 0; // interlace
    return chunk("IHDR", d);
  };

  const splitIntoChunks = (segments, maxSize) => {
    const pieces = [];
    let buf = new Uint8Array(0);
    for (const seg of segments) {
      let off = 0;
      while (off < seg.length) {
        const room = maxSize - buf.length;
        const take = Math.min(room, seg.length - off);
        if (buf.length === 0 && take === seg.length - off && take <= maxSize) {
          buf = seg.subarray(off, off + take);
        } else {
          const nb = new Uint8Array(buf.length + take);
          nb.set(buf, 0);
          nb.set(seg.subarray(off, off + take), buf.length);
          buf = nb;
        }
        off += take;
        if (buf.length === maxSize) {
          pieces.push(buf);
          buf = new Uint8Array(0);
        }
      }
    }
    if (buf.length) pieces.push(buf);
    return pieces;
  };

  class PngEncoder {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.rowsWritten = 0;
      this.adlerA = 1;
      this.adlerB = 0;
      this.deflatedChunks = [];
  this.overlayTopPx = 0;
  this.overlayBottomPx = 0;
  this.overlayTopData = null; // Uint8Array rows*width*4
  this.overlayBottomData = null; // Uint8Array rows*width*4
      this.cs = new CompressionStream("deflate-raw");
      this.writer = this.cs.writable.getWriter();
      this.reader = this.cs.readable.getReader();
      this.readDone = (async () => {
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) this.deflatedChunks.push(new Uint8Array(value));
        }
      })();
    }

    setOverlay(topPx, bottomPx, imageData) {
      const w = this.width;
      const h = imageData.height;
      const bpr = w * 4;
      const top = Math.max(0, Math.min(topPx | 0, h));
      const bottom = Math.max(0, Math.min(bottomPx | 0, h));
      this.overlayTopPx = top;
      this.overlayBottomPx = bottom;
      if (top > 0) {
        const topBytes = top * bpr;
        const src = imageData.data;
        this.overlayTopData = new Uint8Array(topBytes);
        this.overlayTopData.set(src.subarray(0, topBytes));
      } else {
        this.overlayTopData = null;
      }
      if (bottom > 0) {
        const src = imageData.data;
        const start = Math.max(0, (h - bottom) * bpr);
        const end = start + bottom * bpr;
        this.overlayBottomData = new Uint8Array(bottom * bpr);
        this.overlayBottomData.set(src.subarray(start, end));
      } else {
        this.overlayBottomData = null;
      }
    }

    setOverlayTop(topPx, imageData) {
      const w = this.width;
      const h = imageData.height;
      const bpr = w * 4;
      const top = Math.max(0, Math.min(topPx | 0, h));
      this.overlayTopPx = top;
      if (top > 0) {
        const topBytes = top * bpr;
        const src = imageData.data;
        this.overlayTopData = new Uint8Array(topBytes);
        this.overlayTopData.set(src.subarray(0, topBytes));
      } else {
        this.overlayTopData = null;
      }
    }

    setOverlayBottom(bottomPx, imageData) {
      const w = this.width;
      const h = imageData.height;
      const bpr = w * 4;
      const bottom = Math.max(0, Math.min(bottomPx | 0, h));
      this.overlayBottomPx = bottom;
      if (bottom > 0) {
        const src = imageData.data;
        const start = Math.max(0, (h - bottom) * bpr);
        const end = start + bottom * bpr;
        this.overlayBottomData = new Uint8Array(bottom * bpr);
        this.overlayBottomData.set(src.subarray(start, end));
      } else {
        this.overlayBottomData = null;
      }
    }

    async appendImageData(imageData, rows, srcStartRow = 0) {
      const width = this.width;
      const startRow = Math.max(0, srcStartRow | 0);
      const totalRows = Math.max(0, Math.min(rows, imageData.height - startRow));
      const src = imageData.data; // Uint8ClampedArray
      const bytesPerRow = width * 4;
      const line = new Uint8Array(1 + bytesPerRow);
      const absStart = this.rowsWritten;
      for (let y = 0; y < totalRows; y++) {
        line[0] = 0; // Filter 0
        const start = (startRow + y) * width * 4;
        // 先填充原始内容
        line.set(src.subarray(start, start + bytesPerRow), 1);
        // 覆盖顶部/底部固定覆盖层
        const absY = absStart + y;
        if (this.overlayTopData && this.overlayTopPx > 0 && absY < this.overlayTopPx) {
          const oStart = absY * bytesPerRow;
          line.set(this.overlayTopData.subarray(oStart, oStart + bytesPerRow), 1);
        } else if (this.overlayBottomData && this.overlayBottomPx > 0 && absY >= (this.height - this.overlayBottomPx)) {
          const bottomRow = absY - (this.height - this.overlayBottomPx);
          const oStart = bottomRow * bytesPerRow;
          line.set(this.overlayBottomData.subarray(oStart, oStart + bytesPerRow), 1);
        }
        // 更新 adler32（包含过滤字节）
        [this.adlerA, this.adlerB] = adler32Update(
          this.adlerA,
          this.adlerB,
          line
        );
        // 压缩
        await this.writer.write(line);
        this.rowsWritten++;
      }
    }

    async finalizeToBlob() {
      // 若还未写满，补齐空行，避免最终高度不足
      if (this.rowsWritten < this.height) {
        const bytesPerRow = this.width * 4;
        const line = new Uint8Array(1 + bytesPerRow);
        line[0] = 0; // Filter 0
        while (this.rowsWritten < this.height) {
          // 清零像素区
          line.fill(0, 1);
          const absY = this.rowsWritten;
          // 若处于覆盖层区域，填充覆盖层像素，避免底部出现空白
          if (this.overlayTopData && this.overlayTopPx > 0 && absY < this.overlayTopPx) {
            const oStart = absY * bytesPerRow;
            line.set(this.overlayTopData.subarray(oStart, oStart + bytesPerRow), 1);
          } else if (
            this.overlayBottomData && this.overlayBottomPx > 0 && absY >= (this.height - this.overlayBottomPx)
          ) {
            const bottomRow = absY - (this.height - this.overlayBottomPx);
            const oStart = bottomRow * bytesPerRow;
            line.set(this.overlayBottomData.subarray(oStart, oStart + bytesPerRow), 1);
          }
          [this.adlerA, this.adlerB] = adler32Update(this.adlerA, this.adlerB, line);
          await this.writer.write(line);
          this.rowsWritten++;
        }
      }
      await this.writer.close();
      await this.readDone;

      const zlibHeader = new Uint8Array([0x78, 0x9c]);
      const adler = (this.adlerB % MOD_ADLER << 16) | this.adlerA % MOD_ADLER;
      const adlerBytes = u32be(adler >>> 0);

      const idatSegments = [zlibHeader, ...this.deflatedChunks, adlerBytes];

      const parts = [];
      parts.push(pngSignature());
      parts.push(makeIHDR(this.width, this.height));
      const MAX_IDAT = 1 << 20; // 1MB per IDAT
      const idatPieces = splitIntoChunks(idatSegments, MAX_IDAT);
      for (const piece of idatPieces) parts.push(chunk("IDAT", piece));
      parts.push(chunk("IEND", new Uint8Array(0)));

      return new Blob(parts, { type: "image/png" });
    }
  }

  let encoder = null;

  const decodeToImageData = async (dataUrl, expectedWidth) => {
    const res = await fetch(dataUrl);
    const b = await res.blob();
    const bmp = await createImageBitmap(b);
    const h = bmp.height;
    const canvas = new OffscreenCanvas(expectedWidth, h);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, expectedWidth, h);
    ctx.drawImage(bmp, 0, 0, expectedWidth, h);
    const imageData = ctx.getImageData(0, 0, expectedWidth, h);
    bmp.close?.();
    return imageData;
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        if (msg?.type === "PNG_INIT") {
          encoder = new PngEncoder(msg.width, msg.height);
          sendResponse({ ok: true });
          return;
        }
        if (msg?.type === "PNG_SET_OVERLAY") {
          if (!encoder) throw new Error("encoder not initialized");
          const imageData = await decodeToImageData(msg.dataUrl, encoder.width);
          const hasTop = Object.prototype.hasOwnProperty.call(msg, "topPx");
          const hasBottom = Object.prototype.hasOwnProperty.call(msg, "bottomPx");
          if (hasTop && hasBottom) {
            const topPx = Math.max(0, msg.topPx | 0);
            const bottomPx = Math.max(0, msg.bottomPx | 0);
            encoder.setOverlay(topPx, bottomPx, imageData);
            sendResponse({ ok: true, topPx, bottomPx });
          } else if (hasTop) {
            const topPx = Math.max(0, msg.topPx | 0);
            encoder.setOverlayTop(topPx, imageData);
            sendResponse({ ok: true, topPx });
          } else if (hasBottom) {
            const bottomPx = Math.max(0, msg.bottomPx | 0);
            encoder.setOverlayBottom(bottomPx, imageData);
            sendResponse({ ok: true, bottomPx });
          } else {
            sendResponse({ ok: false, error: "no overlay fields" });
          }
          return;
        }
        if (msg?.type === "PNG_APPEND_TILE") {
          if (!encoder) throw new Error("encoder not initialized");
          if (!msg.dataUrl) {
            sendResponse({ ok: false, err: "no dataUrl" });
            return;
          }
          const imageData = await decodeToImageData(
            msg.dataUrl,
            msg.expectedWidth
          );
          const rowsReq = Math.max(0, msg.rows | 0);
          const startRow = Math.max(0, msg.startRow | 0);
          const rows = Math.min(rowsReq, Math.max(0, imageData.height - startRow));
          if (rows > 0) {
            await encoder.appendImageData(imageData, rows, startRow);
          }
          sendResponse({ ok: true, rows });
          return;
        }
        if (msg?.type === "PNG_FINALIZE") {
          if (!encoder) throw new Error("encoder not initialized");
          const blob = await encoder.finalizeToBlob();
          const url = URL.createObjectURL(blob);
          const filename = msg.filename || `fullpage-${Date.now()}.png`;
          // chrome.downloads.download({ url, filename });
          encoder = null;
          sendResponse({ ok: true, url, filename });
          return;
        }
      } catch (e) {
        console.error("offscreen PNG error:", e);
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // 异步
  });
})();
