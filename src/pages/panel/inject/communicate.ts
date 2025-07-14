type ICommunication = {
  // 当前激活标签的tabId
  tabId: number;
  ports: Record<string, any>;
};

export const communication: ICommunication = { tabId: 0, ports: {} };
// 用来接受标签页传送的信息
chrome.runtime.onConnect.addListener((port) => {
  console.log(port);
  console.log(communication.tabId);
  if (port?.sender?.tab?.id === communication.tabId) {
    const frameId = port?.sender?.frameId;
    if (frameId) {
      communication.ports[frameId] = port;
    }
    port.onMessage.addListener((request) => {
      console.log(request);
      if (request.uid) {
      }
    });
  }
});
