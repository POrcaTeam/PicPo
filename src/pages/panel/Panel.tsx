import React from "react";
import "@pages/panel/Panel.css";

// 导入注入的方法
import { communication } from "./inject/communicate";

export default function Panel() {
  React.useEffect(() => {
    // 查询网页内所有图片
    chrome.windows.getCurrent((currentWindow) => {
      // 此方法可以在外挂到网页内执行
      chrome.tabs.query(
        { active: true, windowId: currentWindow.id },
        async (activeTabs) => {
          const tabId = activeTabs[0].id || 0;

          communication.tabId = tabId;
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
        }
      );
    });
  }, []);

  const onCollector = React.useCallback(() => {
    alert("123");
  }, []);
  return (
    <div className="container">
      <h1>Side Panel</h1>
      <button className="bg-amber-200 cursor-pointer" onClick={onCollector}>
        抓取页面
      </button>
    </div>
  );
}

function findImages() {
  const result = window.collector.loop();
  console.log(result);
}
