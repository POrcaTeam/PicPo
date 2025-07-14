console.log("background script loaded");

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

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
chrome.runtime.onMessage.addListener(startDownload);

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
