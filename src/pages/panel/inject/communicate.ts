import { useCallback, useRef, useEffect } from "react";
import { isNumber } from "es-toolkit/compat";
import { useShallow } from "zustand/shallow";

import { useImageStore } from "@src/stores/image-stores";

export type ICommunication = {
  tabId: number; // 当前激活标签的tabId
  ports: Record<string, chrome.runtime.Port>;
  funcs: Record<
    string,
    (response: { uid: string; href: string }) => Promise<void>
  >; // 生成动态方法,用作下载后回调
};

/**
 * 根据tabid建立通讯
 * @param tabId 标签页id
 * @param callback 创建成功后回调
 */
export const useCommunication = (
  tabId: number,
  callback: () => void,
  onMessage?: (request: any) => void
) => {
  const { addLinks, setProgress } = useImageStore(
    useShallow((store) => ({
      addLinks: store.addLinks,
      setProgress: store.setProgress,
    }))
  );

  // 用来记录标签id和所有标签内的iframe通讯port
  const communication = useRef<ICommunication>({
    tabId,
    ports: {},
    funcs: {},
  });

  useEffect(() => {
    communication.current.tabId = tabId;
    // 遍历清空状态
    Object.keys(communication.current.ports).forEach((key) => {
      const value =
        communication.current.ports[
          key as keyof typeof communication.current.ports
        ]; // 类型安全
      // 断开链接
      value.disconnect();
    });
    communication.current.ports = {};
  }, [tabId]);

  const onConnect = useCallback((port: chrome.runtime.Port) => {
    console.log(port);
    console.log(communication.current.tabId);
    if (port?.sender?.tab?.id === communication.current.tabId) {
      const frameId = port?.sender?.frameId;
      if (isNumber(frameId)) {
        communication.current.ports[frameId] = port;
      }
      port.onMessage.addListener((request) => {
        // uid用来接收返回的回调
        // 具体用法为提前设置图片下载成功的回调方法，当页面嵌入代码下载图片成功后，调用此回调方法
        if (request.uid) {
          communication.current.funcs[request.uid](request);
          delete communication.current.funcs[request.uid];
        } else {
          // 当返回的是图片时插入frameId
          if (request.cmd === "images") {
            // 绑定frameId到图片为内部数据下载提供支持
            request.images.forEach(
              (img: ImageEntry) => (img.frameId = frameId)
            );
          } else if (request.cmd === "links") {
            addLinks?.(request.length);
          } else if (request.cmd === "progress") {
            setProgress?.(request.value);
          }
          // 如果添加links

          onMessage?.(request);
        }
      });
    }
  }, []);

  // 监控tabId,若发生改变重新绑定listener
  useEffect(() => {
    // 用来接受标签页传送的信息
    chrome.runtime.onConnect.addListener(onConnect);
    if (typeof callback === "function") {
      callback();
    }
    () => {
      chrome.runtime.onConnect.removeListener(onConnect);
    };
  }, [tabId]);

  // 结束时关闭所有链接，重置规则
  const dispose = useCallback(() => {
    for (const port of Object.values(communication.current.ports)) {
      port.postMessage({
        cmd: "stop-collector",
      });
    }
    chrome.declarativeNetRequest
      .updateSessionRules({
        removeRuleIds: [tabId],
      })
      .catch(() => {});
  }, []);

  return { communication, dispose };
};
