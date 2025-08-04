import { useState, useEffect, useCallback, useRef } from "react";
import { useShallow } from "zustand/shallow";

// 导入注入的方法
import { useCommunication } from "./inject/communicate";
import { Filter } from "./components/filter";
import { Action } from "./components/action";
import { List, ListFunction } from "./components/list";
import { useImageStore } from "@src/stores/image-stores";
import { Progress } from "./components/progress";
import { ErrEl } from "./err";
import { useAsyncMemo } from "@src/lib/hooks/useAsyncMemo";

import "@pages/panel/Panel.css";
import { useUnmount } from "./inject/useUnmount";
import { connStore } from "@src/stores/conn-store";
import { Download } from "./components/download";

export default function Panel() {
  const { addImages, addLinks, allFrames } = useImageStore(
    useShallow((store) => ({
      addImages: store.addImages,
      addLinks: store.addLinks,
      allFrames: store.allFrames,
    }))
  );

  // 是否是真实网页
  const isRealWebPage = useAsyncMemo(async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const url = tab?.url || "";
    if (!tab.id) return false;

    const realWebPage =
      !url.startsWith("chrome://") && !url.startsWith("chrome-extension://");
    if (realWebPage) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => console.log("Hello from content script"),
        });
      } catch (err: any) {
        if (err.message.includes("scripting is restricted")) {
          console.warn("脚本注入被限制：", err.message);
          // 你可以选择提示用户或禁用某些功能
          return false;
        } else {
          console.error("其他脚本注入错误：", err.message);
          return false;
        }
      }
    }
    return realWebPage;
  }, []);

  const [tabId, setTabId] = useState<number>(0);
  useEffect(() => {
    // 查询网页内所有图片
    isRealWebPage &&
      chrome.windows.getCurrent((currentWindow) => {
        // 此方法可以在外挂到网页内执行
        chrome.tabs.query(
          { active: true, windowId: currentWindow.id },
          async (activeTabs) => {
            const tabId = activeTabs[0].id || 0;
            setTabId(tabId);
          }
        );
      });
  }, [isRealWebPage]);

  // 得到数据发送通道实例，可以向指定frameId发送消息
  const { communication, dispose } = useCommunication(
    tabId,
    async (conn) => {
      if (!tabId) return;
      connStore.getState().setCommunicationRef?.(conn);
      // 当panel显示时再加载通讯组件可以保证连接
      // 加载消息通信组件，用来实时从标签页获取数据
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        injectImmediately: true,
        files: ["/port.js"],
      });
      // 在标签页中执行函数，查找图片
      chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: findImages,
      });
    },
    // 当接收到消息时
    (request) => {
      if (request.cmd === "images") {
        const images = request.images;
        addImages?.(images);
      }
    }
  );

  const listRef = useRef<ListFunction>(null);
  const onCheckedChange = useCallback((checked: boolean) => {
    listRef.current && listRef.current.onAllChecked(checked);
  }, []);

  // 退出释放状态
  useUnmount(() => {
    dispose();
  });
  return (
    <div className="container flex flex-col flex-nowrap items-center justify-center h-dvh">
      {!isRealWebPage && <ErrEl />}
      {isRealWebPage && (
        <>
          <div className="w-full">
            <Progress />
            <Download />
          </div>
          <div className="flex flex-col p-2 py-0 mt-[5px] flex-1 w-full min-h-1 transition-all duration-100">
            <Filter />
            <Action
              onCheckedChange={onCheckedChange}
              communication={communication}
            />
            <List
              ref={listRef}
              className="flex-1 basis-1 min-h-1 overflow-y-auto"
            />
          </div>
        </>
      )}
    </div>
  );
}

function findImages() {
  // 设置为采集状态
  window.collector.active = true;
  const _result = window.collector.loop();
}
