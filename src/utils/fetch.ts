{
  type ApplyRefererRequest = {
    cmd: "apply-referer";
    src: string;
    referer: string;
  };

  type RevokeRefererRequest = {
    cmd: "revoke-referer";
    id: number;
  };

  const applyReferer = (src: string, referer: string): Promise<number> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage<ApplyRefererRequest>(
        { cmd: "apply-referer", src, referer },
        resolve
      );
      setTimeout(() => resolve(-1), 1000);
    });
  };

  const revokeReferer = (id: number): Promise<number> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage<RevokeRefererRequest>(
        { cmd: "revoke-referer", id },
        resolve
      );
      setTimeout(() => resolve(-1), 1000);
    });
  };

  // 覆盖 fetch 函数
  self.fetch = new Proxy(self.fetch, {
    apply(target, thisArg, argArray: [RequestInfo, RequestInit?]) {
      const [src, props] = argArray;
      const url =
        typeof src === "string" ? src : src instanceof Request ? src.url : "";

      if (
        url.startsWith("http") &&
        props?.headers &&
        typeof props.headers === "object"
      ) {
        const referer = (props.headers as Record<string, string>)["referer"];
        if (referer && referer.startsWith("http")) {
          return applyReferer(url, referer).then((id) => {
            return Reflect.apply(target, thisArg, argArray)
              .then((response: Response) => {
                revokeReferer(id);
                return response;
              })
              .catch((error: any) => {
                revokeReferer(id);
                throw error;
              });
          });
        }
      }

      return Reflect.apply(target, thisArg, argArray);
    },
  });
}
