import { useEffect, useLayoutEffect } from "react";

import "./screenshot";

export const Content = () => {
  useLayoutEffect(() => {
    // install network
    const tabId = (window as any).tabId;
  }, []);
  return <></>;
};
