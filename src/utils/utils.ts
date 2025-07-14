export const extractUrls = (content: string) => {
  try {
    const r =
      /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
    return content.match(r) || [];
  } catch (e) {
    console.info("link extraction failed", e);
  }
  return [];
};

export interface ResponseSegment {
  ok: true;
  type: string;
  size: number;
  disposition: string;
  segment: Uint8Array;
}

export interface ResponseHead {
  ok: true;
  type: string;
  size: number;
  disposition: string;
}

export class Utils {
  static EXTENSIONS: Record<string, string> = {
    css: "text/css",
    html: "text/html",
    js: "text/javascript",
    flv: "video/flv",
    mp4: "video/mp4",
    m3u8: "application/x-mpegURL",
    ts: "video/MP2T",
    "3gp": "video/3gpp",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    wmv: "video/x-ms-wmv",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    ogg: "audio/x-mpegurl",
    wav: "audio/vnd.wav",
    png: "image/png",
    jpeg: "image/jpeg",
    jpg: "image/jpg",
    bmp: "image/bmp",
    cur: "image/cur",
    gif: "image/gif",
    ico: "image/ico",
    icns: "image/icns",
    psd: "image/psd",
    svg: "image/svg",
    tiff: "image/tiff",
    webp: "image/webp",
  };

  static rename(str: string): string {
    return str
      .replace(/[`~!@#$%^&*()|+=?;:'",.<>{}[\]]/gi, "-")
      .replace(/[\\/]/gi, "_");
  }

  static guess(
    img: ImageEntry,
    mask: string,
    noType = true
  ): { filename: string; name: string } {
    const indices: Record<string, number> = {};
    const { disposition, type, src, page, size } = img;

    let name = img.name || "";
    if (!name && disposition) {
      let tmp = /filename\*=UTF-8''([^;]*)/.exec(disposition);
      if (tmp) {
        name = decodeURIComponent(
          tmp[1].replace(/["']$/, "").replace(/^["']/, "")
        );
      }
      if (!name) {
        tmp = /filename=([^;]*)/.exec(disposition);
        if (tmp) {
          name = tmp[1].replace(/["']$/, "").replace(/^["']/, "");
        }
      }
    }

    if (!name && page) {
      for (const ext of ["jpeg", "jpg", "png", "gif", "bmp", "webp"]) {
        const i = page.toLowerCase().indexOf("." + ext);
        if (i !== -1 && ~~(size as any) > 500 * 1024) {
          name = page.slice(0, i).split("/").pop() || "";
          break;
        }
      }
    }

    if (!name) {
      if (src.startsWith("http")) {
        const url = src.replace(/\/$/, "");
        const tmp = /(title|filename)=([^&]+)/.exec(url);
        name = tmp?.[2] || url.substring(url.lastIndexOf("/") + 1);
        try {
          name =
            decodeURIComponent(name.split("?")[0].split("&")[0]) || "image";
        } catch {}
      } else {
        name = "image";
      }
    }

    if (disposition && name) {
      const arr = [...name].map((v) => v.charCodeAt(0)).filter((v) => v <= 255);
      name = new TextDecoder("UTF-8").decode(Uint8Array.from(arr));
    }

    if (name.indexOf(".") === -1 && type && type !== "image/unknown") {
      name += "." + type.split("/").pop()?.split(/[+;]/)[0];
    }

    let index = name.lastIndexOf(".");
    if (index === -1) index = name.length;

    let extension = name.slice(index).slice(0, 10);
    if (!extension && noType) extension = ".jpg";

    name = name.slice(0, index);
    if (name.startsWith("%")) {
      name = decodeURIComponent(name);
    }

    indices[name] = (indices[name] || 0) + 1;

    let filename = (mask || "[name][extension]")
      .split("[extension]")
      .map((str) => {
        str = str
          .replace(
            /\[name\]/gi,
            name + (indices[name] === 1 ? "" : "-" + indices[name])
          )
          .replace(/\[type\]/gi, type || "")
          .replace(/\[disposition\]/gi, disposition || "")
          .replace(/\[alt\]/gi, img.alt || "")
          .replace(/\[order\]/gi, "__ORDER__")
          .replace(/\[index\]/gi, String(indices[name]))
          .replace(/\[custom=[^\]]+\]/gi, img.custom || "");

        str = Utils.rename(str).slice(0, 60);
        return str;
      })
      .join(extension);

    return { filename, name };
  }

  static size(r: Response): number {
    const size = Number(r.headers.get("content-length"));
    if (size && !isNaN(size)) return size;

    if (r.url.startsWith("data:")) {
      const [header, ...bodies] = r.url.split(",");
      const body = bodies.join(",");
      if (header.includes("base64")) {
        try {
          return atob(body).length;
        } catch {}
      }
      return body.length;
    }
    return 0;
  }

  static type(
    img: ImageEntry = {} as ImageEntry,
    response: ResponseSegment | { type: string }
  ): string {
    if (response.type?.startsWith("text/")) return response.type;
    return img.type || response.type || "";
  }

  static async response(
    o: { src: string; page?: string },
    timeoutKey: string = "default-timeout"
  ): Promise<{ response: Response; controller: AbortController }> {
    const prefs = await new Promise<Record<string, number>>((res) =>
      chrome.storage.local.get({ [timeoutKey]: 30000 }, res)
    );

    const controller = new AbortController();
    setTimeout(() => controller.abort(), prefs[timeoutKey]);

    const r = await fetch(o.src, {
      signal: controller.signal,
      headers: {
        referer: o.page || "",
      },
    });

    if (!r.ok) throw new Error(`STATUS_CODE_${r.status}`);

    return { response: r, controller };
  }

  static responseText = async (o: {
    src: string;
    page?: string;
  }): Promise<string> => {
    try {
      const { response } = await Utils.response(o, "dig-timeout");
      return await response.text();
    } catch {
      return "";
    }
  };

  static responseSegment = async (o: {
    src: string;
    page?: string;
  }): Promise<ResponseSegment> => {
    const { response, controller } = await Utils.response(o, "head-timeout");
    const segment = (await response.body!.getReader().read()).value!;
    setTimeout(() => controller.abort());
    return {
      ok: true,
      type: response.headers.get("content-type") || "",
      size: Utils.size(response),
      disposition: response.headers.get("content-disposition") || "",
      segment,
    };
  };

  static responseHeads = async (o: {
    src: string;
    page?: string;
  }): Promise<ResponseHead | {}> => {
    try {
      const { response, controller } = await Utils.response(o, "head-timeout");
      setTimeout(() => controller.abort());
      return {
        ok: true,
        type: response.headers.get("content-type") || "",
        size: Utils.size(response),
        disposition: response.headers.get("content-disposition") || "",
      };
    } catch {
      return {};
    }
  };
}
