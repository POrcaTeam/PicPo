chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// 当插件点击时加载
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const tabId = tab.id;
    tabId &&
      chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [tabId],
        addRules: [
          {
            id: tabId,
            priority: 1,
            action: {
              type: "modifyHeaders",
              responseHeaders: [
                {
                  operation: "set",
                  header: "access-control-allow-origin",
                  value: "*",
                },
              ],
            },
            condition: {
              resourceTypes: ["xmlhttprequest", "image"],
              tabIds: [tabId],
            },
          },
        ] as any,
      });
  } catch (e) {
    console.warn(e);
    // notify("Cannot collect images on this tab\n\n" + e.message);
  }
});

// 插件关闭时
chrome.tabs.onRemoved.addListener((tabId) =>
  // 禁用网络规则
  chrome.declarativeNetRequest
    .updateSessionRules({
      removeRuleIds: [tabId],
    })
    .catch(() => {})
);
