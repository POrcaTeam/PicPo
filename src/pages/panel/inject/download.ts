// 此方法为panel内数据下载

import { isNumber } from "es-toolkit/compat";
import { ICommunication } from "./communicate";

// 从页面内动态获取图片
export const getImageFromPage = (
  communication: ICommunication,
  o: ImageEntry
): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    // 生成uid,当图片获取成功后调取此uid所指向的方法
    const uid = Math.random();
    if (isNumber(o.frameId)) {
      const port = communication.ports[o.frameId];
      communication.funcs[uid] = async (response) => {
        try {
          try {
            const r = await fetch(response.href);
            resolve(await r.arrayBuffer());
          } catch (e) {
            const r = await fetch(o.src);
            resolve(await r.arrayBuffer());
          }
        } catch (e) {
          reject(e);
        }
        if (response.href) {
          URL.revokeObjectURL(response.href);
        }
      };
      port.postMessage({
        cmd: "download-image",
        src: o.src,
        referer: o.page,
        uid,
      });
    }
  });
};
