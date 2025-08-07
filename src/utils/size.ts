{
  // Type definitions for size result
  interface ImageSize {
    type: string;
    width: number;
    height: number;
  }

  // Utility function: convert Uint8Array to hex string
  const hex = (uint8a: Uint8Array, start: number, end: number): string => {
    return [...uint8a.slice(start, end)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  };

  // Define type checkers
  const type: { [key: string]: (uint8a: Uint8Array) => boolean } = {};
  // Define size extractors
  const size: { [key: string]: (uint8a: Uint8Array) => ImageSize | undefined } =
    {};

  self.type = type;
  self.size = size;

  // PNG
  type.png = (uint8a: Uint8Array): boolean => {
    const b = String.fromCharCode(...uint8a.slice(0, 10));
    return b.slice(1, 8) === "PNG\r\n\x1a\n";
  };

  size.png = (uint8a: Uint8Array): ImageSize => {
    const b = String.fromCharCode(...uint8a.slice(0, 40));
    const view = new DataView(uint8a.buffer);
    if (b.slice(12, 16) === "CgBI") {
      return {
        type: "image/png",
        width: view.getUint32(36, false),
        height: view.getUint32(32, false),
      };
    } else {
      return {
        type: "image/png",
        width: view.getUint32(16, false),
        height: view.getUint32(20, false),
      };
    }
  };

  // GIF
  type.gif = (uint8a: Uint8Array): boolean => {
    const b = String.fromCharCode(...uint8a.slice(0, 6));
    return /^GIF8[79]a/.test(b);
  };

  size.gif = (uint8a: Uint8Array): ImageSize => {
    const view = new DataView(uint8a.buffer);
    return {
      type: "image/gif",
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
    };
  };

  // BMP
  type.bmp = (uint8a: Uint8Array): boolean => {
    const b = String.fromCharCode(...uint8a.slice(0, 2));
    return b === "BM";
  };

  size.bmp = (uint8a: Uint8Array): ImageSize => {
    const view = new DataView(uint8a.buffer);
    return {
      type: "image/bmp",
      width: view.getUint32(18, true),
      height: Math.abs(view.getUint32(22, true)),
    };
  };

  // WEBP
  type.webp = (uint8a: Uint8Array): boolean => {
    // 检查长度
    if (uint8a.length < 16) return false;

    // 检查 "RIFF"
    if (
      uint8a[0] !== 0x52 || // R
      uint8a[1] !== 0x49 || // I
      uint8a[2] !== 0x46 || // F
      uint8a[3] !== 0x46 // F
    ) {
      return false;
    }

    // 检查 "WEBP"
    if (
      uint8a[8] !== 0x57 || // W
      uint8a[9] !== 0x45 || // E
      uint8a[10] !== 0x42 || // B
      uint8a[11] !== 0x50 // P
    ) {
      return false;
    }

    // 检查 VP8 / VP8L / VP8X
    const format = String.fromCharCode(
      uint8a[12],
      uint8a[13],
      uint8a[14],
      uint8a[15]
    );

    return format === "VP8 " || format === "VP8L" || format === "VP8X";
  };

  size.webp = (uint8a: Uint8Array): ImageSize | undefined => {
    const chunkHeader = String.fromCharCode(...uint8a.slice(12, 16));

    // VP8X (Extended WebP)
    if (chunkHeader === "VP8X") {
      if (uint8a.length < 30) return;

      const width = (uint8a[24] << 16) | (uint8a[23] << 8) | uint8a[22];
      const height = (uint8a[27] << 16) | (uint8a[26] << 8) | uint8a[25];

      return {
        type: "image/webp",
        width: width + 1,
        height: height + 1,
      };
    }

    // VP8 (Lossy WebP)
    if (chunkHeader === "VP8 ") {
      if (uint8a.length < 30) return;

      // VP8 lossy header starts at offset 20
      const view = new DataView(uint8a.buffer, uint8a.byteOffset + 20, 10);
      const width = view.getUint16(6, true) & 0x3fff;
      const height = view.getUint16(8, true) & 0x3fff;

      return {
        type: "image/webp",
        width,
        height,
      };
    }

    // VP8L (Lossless WebP)
    if (chunkHeader === "VP8L") {
      if (uint8a.length < 25) return;

      // Signature check (should be 0x2f)
      if (uint8a[20] !== 0x2f) return;

      const b0 = uint8a[21];
      const b1 = uint8a[22];
      const b2 = uint8a[23];
      const b3 = uint8a[24];

      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));

      return {
        type: "image/webp",
        width,
        height,
      };
    }

    return undefined;
  };

  // JPG
  type.jpg = (uint8a: Uint8Array): boolean => {
    const SOIMarker = hex(uint8a, 0, 2);
    return SOIMarker === "ffd8";
  };

  size.jpg = (uint8a: Uint8Array): ImageSize | undefined => {
    const view = new DataView(uint8a.buffer);
    for (let offset = 4; offset < uint8a.byteLength; ) {
      const blockLength = view.getUint16(offset, false);
      const marker = uint8a[offset + blockLength + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const slice = uint8a.buffer.slice(offset + blockLength + 5);
        const frameView = new DataView(slice);
        return {
          type: "image/jpeg",
          height: frameView.getUint16(0, false),
          width: frameView.getUint16(2, false),
        };
      }
      offset += blockLength + 2;
    }
    return undefined;
  };

  // SVG 类型识别
  type.svg = (uint8a: Uint8Array): boolean => {
    const str = new TextDecoder().decode(uint8a.slice(0, 1000)).trim();
    return str.startsWith("<svg") || str.includes("<svg ");
  };

  // SVG 尺寸提取
  size.svg = (uint8a: Uint8Array): ImageSize | undefined => {
    try {
      const str = new TextDecoder().decode(uint8a);
      const svgMatch = str.match(/<svg[^>]+>/);
      if (!svgMatch) return undefined;

      const svgTag = svgMatch[0];

      // 提取 width 和 height
      const widthMatch = svgTag.match(
        /width\s*=\s*["']?([\d.]+)([a-z%]*)["']?/i
      );
      const heightMatch = svgTag.match(
        /height\s*=\s*["']?([\d.]+)([a-z%]*)["']?/i
      );

      if (widthMatch && heightMatch) {
        return {
          type: "image/svg+xml",
          width: parseFloat(widthMatch[1]),
          height: parseFloat(heightMatch[1]),
        };
      }

      // 如果没有显式的 width/height，尝试用 viewBox 提取
      const viewBoxMatch = svgTag.match(
        /viewBox\s*=\s*["']?([\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+)["']?/i
      );
      if (viewBoxMatch) {
        const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
        if (parts.length === 4) {
          return {
            type: "image/svg+xml",
            width: parts[2],
            height: parts[3],
          };
        }
      }
    } catch (e) {
      console.warn("Failed to parse SVG size:", e);
    }
    return undefined;
  };
}
