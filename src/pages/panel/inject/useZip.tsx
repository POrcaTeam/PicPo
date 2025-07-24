import { useEffect, useRef, useState } from "react";

export const useWorkerZip = () => {
  const [completeCount, setCompleteCount] = useState(0);
  const zipWorkerRef = useRef<Worker>(null);

  useEffect(() => {
    zipWorkerRef.current = new Worker(chrome.runtime.getURL("/zip.js"), {
      type: "module",
    });

    zipWorkerRef.current.onmessage = async (e) => {
      const data = e.data;
      if (data.message === "progress") {
        setCompleteCount((prev) => prev + 1);
      } else if (data.message === "done") {
        if (data.url) {
          let fileName = "";
          if (data.fileName) {
            fileName = data.fileName ? data.fileName + ".zip" : "";
          }
          const a = document.createElement("a");
          a.href = data.url;
          a.download = fileName; // ✅ 设置文件名
          a.click();

          URL.revokeObjectURL(data.url);

          // nativeDownload下载blob数据时无法设置filename
          //   nativeDownload(
          //     {
          //       filename: fileName,
          //       url: data.url,
          //       conflictAction: "uniquify",
          //       saveAs: false,
          //     },
          //     fileName
          //   );
        }
      }
    };

    return () => {
      zipWorkerRef.current?.terminate();
    };
  }, []);

  return { zip: zipWorkerRef, completeCount };
};
