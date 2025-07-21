import { useEffect, useLayoutEffect } from "react";

export const Content = () => {
  useLayoutEffect(() => {
    // install network
    const tabId = (window as any).tabId;
  }, []);
  return <></>;
};
