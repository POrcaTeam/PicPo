import { downloadImages } from "./download";
import "./rules";

// 消息提醒
const notify = (message: string) =>
  chrome.storage.local.get(
    {
      notify: true,
    },
    (prefs) =>
      prefs.notify &&
      chrome.notifications.create(
        {
          type: "basic",
          title: chrome.runtime.getManifest().name,
          message,
          iconUrl: "icon-128.png",
        },
        (id) => setTimeout(chrome.notifications.clear, 3000, id)
      )
  );

notify("background script已加载");

const tasks = new Set<Task>();

// 任务对象
type Task = {
  numberOfProcessedImages: number;
  imagesToDownload: string[];
  options: any;
  next: () => void;
};

// 绑定浏览器下载
// 下载同步两种方式,一种是直接下载到本地,一种是同步到picorca中
// 同步到picorca直接走webrtc连接
// chrome.runtime.onMessage.addListener(startDownload);

// 绑定其他事件
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.debug("Message received:", message); // 调试日志
  // 如果是从side panel中请求，这里判断 origin是否是chrome-extension:// 开头
  if (sender.origin && sender.origin.startsWith("chrome-extension:")) {
    return command(message, sendResponse);
  }
  // 未打开标签页直接返回
  if (!sender.tab) return true;
  if (message.cmd === "apply-referer") {
    try {
      const id = Math.floor(Math.random() * 1000000);
      chrome.declarativeNetRequest
        .updateSessionRules({
          addRules: [
            {
              id: id,
              priority: 1,
              action: {
                type: "modifyHeaders",
                requestHeaders: [
                  {
                    operation: "set",
                    header: "referer",
                    value: message.referer,
                  },
                  {
                    operation: "remove",
                    header: "origin",
                  },
                ],
              },
              condition: {
                urlFilter: message.src,
                resourceTypes: ["xmlhttprequest", "image"],
                tabIds: [sender.tab.id],
              },
            },
          ] as any,
        })
        .then(
          () => sendResponse(id),
          () => sendResponse(-1)
        );

      return true;
    } catch (e) {
      sendResponse(-1);
    }
  } else if (message.cmd === "revoke-referer") {
    if (message.id === -1) {
      sendResponse();
    } else {
      chrome.declarativeNetRequest
        .updateSessionRules({
          removeRuleIds: [message.id],
        })
        .then(
          () => sendResponse(),
          () => sendResponse()
        );

      return true;
    }
  }
});

// 功能性请求消息
const command = async (
  message: any,
  sendResponse: (response?: any) => void
) => {
  let windowId = undefined;
  let tabId = undefined;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    windowId = tabs[0].windowId;
    tabId = tabs[0].id;
  }
  // 绑定截图事件
  if (message.cmd === "screenshot") {
    if (windowId) {
      chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error("Capture failed:", chrome.runtime.lastError);
          return;
        }

        // 打开截图新标签页
        chrome.tabs.create({ url: dataUrl });
      });
    }
    return true; // 保持消息通道开放以异步响应
  }
  // 数据下载
  else if (message.cmd === "downloads") {
    downloadImages(message).then((response) => {
      sendResponse(response);
    });
    return true; // 保持消息通道开放以异步响应
  }
};
