// port作为通用入口,动态注入到标签页中
// 导入其他包
import "./fetch";
import "./size";

type RequireProps<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
type RequestInitModified = RequireProps<RequestInit, "headers">;
{
  // 同panel创建连接
  const connect = chrome.runtime.connect({
    name: "page",
  });
  // 当插件窗口关闭时禁用数据收集
  connect.onDisconnect.addListener((request) => {
    try {
      console.debug(request.sender?.frameId + "lost connection");
      if (window.collector) {
        window.collector.active = false;
      }
    } catch (e) {}
  });
  // 用来传递消息到 background script
  const onPostMessage = (request: any) => {
    // 压缩zip采用客户端数据下载,这里执行客户端下载方法
    if (request.cmd === "download-image") {
      const img = self.sources.get(request.src);
      // try to find the image on page and download it (it is useful specially if the image src is a dead blob)
      const capture = () => {
        const e = img || document.querySelector(`img[src="${request.src}"]`);

        if (!e) {
          return;
        }
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = e.naturalWidth;
        canvas.height = e.naturalHeight;

        ctx && ctx.drawImage(e, 0, 0, canvas.width, canvas.height);
        const href = canvas.toDataURL();

        return connect.postMessage({
          uid: request.uid,
          href,
        });
      };

      const props: RequestInitModified = {
        headers: {
          referer: request.referer,
        },
      };
      if (img && request.referer) {
        if (img.referrerPolicy) {
          if (img.referrerPolicy === "origin") {
            try {
              (props.headers as any).referer =
                new URL(request.referer).origin + "/";
            } catch (e) {}
          } else if (img.referrerPolicy === "no-referrer") {
            delete (props.headers as any).referer;
          }
        }
      }

      fetch(request.src, props)
        .then((r) => {
          if (!r.ok) {
            throw Error("STATUS_CODE_" + r.status);
          }
          return r.blob();
        })
        .then((blob) => {
          const href = URL.createObjectURL(blob);
          connect.postMessage({
            uid: request.uid,
            href,
          });
        })
        .catch((e) => {
          // try to include credentials
          props.credentials = "include";
          fetch(request.src, props)
            .then((r) => {
              if (!r.ok) {
                throw Error("STATUS_CODE_" + r.status);
              }
              return r.blob();
            })
            .then((blob) => {
              const href = URL.createObjectURL(blob);
              connect.postMessage({
                uid: request.uid,
                href,
              });
            })
            .catch((e) => {
              try {
                // can we get the image from an image element
                capture();
              } catch (ee) {
                connect.postMessage({
                  uid: request.uid,
                  error: e.message,
                });
              }
            });
        });
    } else if (request.cmd === "create-directory") {
      // window
      //   .showDirectoryPicker()
      //   .then(async (d) => {
      //     window.directory = d;
      //     if (request.readme) {
      //       const file = await d.getFileHandle(request.name, {
      //         create: true,
      //       });
      //       const writable = await file.createWritable();
      //       const blob = new Blob([request.content], {
      //         type: "text/plain",
      //       });
      //       const response = new Response(blob);
      //       await response.body.pipeTo(writable);
      //     }
      //     port.postMessage({
      //       uid: request.uid,
      //     });
      //   })
      //   .catch((e) => {
      //     port.postMessage({
      //       uid: request.uid,
      //       error: e.message,
      //     });
      //   });
    } else if (request.cmd === "image-to-directory") {
      // Promise.all([
      //   fetch(request.href),
      //   window.directory
      //     .getFileHandle(request.filename, {
      //       create: true,
      //     })
      //     .then((file) => file.createWritable()),
      // ]).then(async ([response, writable]) => {
      //   try {
      //     await writable.truncate(0);
      //     await response.body.pipeTo(writable);
      //   } catch (e) {
      //     console.warn(e);
      //   }
      //   URL.revokeObjectURL(request.href);
      // });
    } else if (request.cmd === "stop-collector") {
      try {
        if (window.collector) {
          window.collector.active = false;
        }
      } catch (e) {}

      // 断开所有链接
      connect.disconnect();
    }
  };
  connect.onMessage.addListener(onPostMessage);

  const post = (request: any) => {
    try {
      connect.postMessage(request);
    } catch (e) {
      console.error("post-error", e);
    }
  };

  self.sources = new Map();
  self.post = post;
}
