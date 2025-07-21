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
  // 未打开标签页直接返回
  if (!sender.tab) return true;
  let windowId = undefined;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      windowId = tabs[0].windowId;
    }
  });
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
  } else if (message.cmd === "apply-referer") {
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

// NOTE: 不要在onMessage中绑定事件使用 `async` 异步方法
// 具体参见
// https://stackoverflow.com/a/56483156
// https://developer.chrome.com/docs/extensions/reference/runtime/#event-onMessage

/**
 *
 * @param message @type {any}
 * @param sender @type {chrome.runtime.MessageSender}
 * @param resolve  @type {(response?: any) => void}
 * @returns
 */
function startDownload(
  message: any,
  sender: chrome.runtime.MessageSender,
  resolve: (response?: any) => void
) {
  // 只接受数据下载事件
  if (!(message && message.type === "collector")) return;

  if (!(message && message.type === "downloadImages")) return;

  downloadImages({
    numberOfProcessedImages: 0,
    imagesToDownload: message.imagesToDownload,
    options: message.options,
    next() {
      this.numberOfProcessedImages += 1;
      if (this.numberOfProcessedImages === this.imagesToDownload.length) {
        tasks.delete(this);
      }
    },
  }).then(resolve);

  return true; // Keeps the message channel open until `resolve` is called
}

async function downloadImages(task: Task) {
  tasks.add(task);
  for (const image of task.imagesToDownload) {
    await new Promise((resolve) => {
      chrome.downloads.download({ url: image }, (downloadId) => {
        if (downloadId == null) {
          if (chrome.runtime.lastError) {
            console.error(`${image}:`, chrome.runtime.lastError.message);
          }
          task.next();
        }
        resolve(true);
      });
    });
  }
}
