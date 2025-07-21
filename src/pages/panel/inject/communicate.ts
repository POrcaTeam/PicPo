import { useImageStore } from "@src/stores/image-stores";
import React from "react";
import { useShallow } from "zustand/shallow";

type ICommunication = {
  // 当前激活标签的tabId
  tabId: number;
  ports: Record<string, chrome.runtime.Port>;
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
  const communication = React.useRef<ICommunication>({ tabId, ports: {} });

  React.useEffect(() => {
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

  const onConnect = React.useCallback((port: chrome.runtime.Port) => {
    console.log(port);
    console.log(communication.current.tabId);
    if (port?.sender?.tab?.id === communication.current.tabId) {
      const frameId = port?.sender?.frameId;
      if (frameId) {
        communication.current.ports[frameId] = port;
      }
      port.onMessage.addListener((request) => {
        //
        if (request.uid) {
        } else {
          // 当返回的是图片时插入frameId
          if (request.cmd === "images") {
            request.images.forEach((img: any) => (img.frameId = frameId));
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
  React.useEffect(() => {
    // 用来接受标签页传送的信息
    chrome.runtime.onConnect.addListener(onConnect);
    if (typeof callback === "function") {
      callback();
    }
    () => {
      chrome.runtime.onConnect.removeListener(onConnect);
    };
  }, [tabId]);
};
