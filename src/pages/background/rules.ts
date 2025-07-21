// 存储每个选项卡的 sidePanel 状态
let tabStates: Record<string, boolean> = {};
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

// 当插件点击时加载
chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id;

  if (!tabId) return;
  // 打开 Side Panel，仅设置当前 tab 可见
  await chrome.sidePanel.setOptions(
    {
      tabId: tab.id,
      path: "src/pages/panel/index.html",
      enabled: true,
    },
    () => {
      console.log("open", tabId);
      // 打开 sidePanel
      chrome.sidePanel.open({ tabId });
      // 保存状态
      tabStates[tabId] = true;
      // 持久化存储状态
      chrome.storage.local.set({ [tabId]: true });
    }
  );

  //   // 主动打开 Side Panel（需要 manifest v3 中开启 side_panel 权限）
  //   await chrome.sidePanel.open({ tabId: tab.id });

  //   // 记录当前打开了 Side Panel 的 tabId
  //   await chrome.storage.session.set({ currentSidePanelTabId: tab.id });

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

// 监听选项卡更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    // 检查存储的状态
    chrome.storage.local.get([String(tabId)], (result) => {
      const isEnabled = result[tabId] || false;
      tabStates[tabId] = isEnabled;

      // 根据状态启用或禁用 sidePanel
      if (!isEnabled) {
        // 设置 sidePanel 状态
        chrome.sidePanel.setOptions({
          enabled: isEnabled,
        });
      } else {
        chrome.sidePanel.setOptions({
          tabId,
          enabled: isEnabled,
        });
      }
    });
  }
});

// 监听选项卡激活事件（切换选项卡）
chrome.tabs.onActivated.addListener((activeInfo) => {
  const tabId = activeInfo.tabId;

  // 获取选项卡信息
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab.url) return;
    // 检查存储的状态
    chrome.storage.local.get([String(tabId)], (result) => {
      const isEnabled = result[tabId] || false;
      tabStates[tabId] = isEnabled;
      console.log(tabId, tabStates);

      if (!isEnabled) {
        // 设置 sidePanel 状态
        chrome.sidePanel.setOptions({
          enabled: isEnabled,
        });
      } else {
        chrome.sidePanel.setOptions({
          tabId,
          enabled: isEnabled,
        });
      }
    });
  });
});

// 监听选项卡关闭事件，清理状态
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabStates[tabId];
  chrome.storage.local.remove(String(tabId));
});
