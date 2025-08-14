import { isRealWebPage } from "@src/utils/utils";

// 创建右键菜单（当扩展安装/更新时）
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "fullpage_screenshot",
    title: chrome.i18n.getMessage("fullpage_screenshot"),
    contexts: ["page", "action"], // 根据需要调整
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "fullpage_screenshot") {
    const url = tab?.url || "";
    if (!tab?.id) return false;
    isRealWebPage(url, tab).then((response) => {
      if (response && tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "START_CAPTURE" });
      }
    });
  }
});
