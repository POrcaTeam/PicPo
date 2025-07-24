import JSZip from "jszip";

let zip: JSZip = new JSZip();
addEventListener(
  "message",
  async (event: MessageEvent<[string, string?, Uint8Array?]>) => {
    const data = event.data;
    // 开始压缩文件
    if (data && data[0] === "start") {
      // 初始化压缩类
      zip = new JSZip();
    } else if (data && data[0] === "addImage") {
      const fileName = data[1];
      const fileBlob = data[2];
      if (fileName && fileBlob) {
        await zip?.file(fileName, fileBlob);
        // 实时发送进度到前端
        postMessage({ message: "progress" });
      }
    } else if (data && data[0] === "done") {
      const fileName = data?.[1] || "";
      zip.generateAsync({ type: "blob" }).then((content) => {
        const url = URL.createObjectURL(content);
        // 发送到调用方法中
        postMessage({ message: "done", url, fileName });
      });
    }
  }
);
