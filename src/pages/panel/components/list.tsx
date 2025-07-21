import { useRef, useEffect, useImperativeHandle } from "react";

import { Checkbox } from "@src/components/ui/checkbox";
import { ImageFunction, Selection } from "./image-selection";
import { Label } from "@src/components/ui/label";
import { cn } from "@src/lib/utils";
import { useImageStore } from "@src/stores/image-stores";
import { Category } from "../category";

const CATEGORIZE = [
  {
    id: "capture",
    name: "捕获",
  },
  {
    id: "primary",
    name: "主图",
  },
  {
    id: "icon",
    name: "图标",
  },
  {
    id: "others",
    name: "其他",
  },
];

// 同步状态方法
export type ListFunction = {
  onAllChecked: (checked: boolean) => void;
};

export const List: React.FC<{
  ref?: React.Ref<ListFunction>;
  className?: string;
}> = ({ className, ref }) => {
  const onScreenShoot = () => {
    chrome.runtime.sendMessage({ cmd: "screenshot" });
  };

  const selectionRef = useRef<ImageFunction>(null);
  useImperativeHandle(
    ref,
    (): ListFunction => ({
      onAllChecked: (checked: boolean) => {
        if (checked) {
          selectionRef.current?.selectedAll();
        } else {
          selectionRef.current?.clear();
        }
      },
    })
  );

  const onChange = (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    console.log(message);
    if (message.cmd === "clear") {
      alert(123);
    }
  };
  useEffect(() => {
    chrome.runtime.onMessage.addListener(onChange);
    return () => {
      chrome.runtime.onMessage.removeListener(onChange);
    };
  }, []);

  return (
    <div
      id="files-scrollbar"
      className={cn(
        "relative flex flex-col flex-nowrap space-y-2 pl-2 pr-3 mr-[-4px]",
        className
      )}
    >
      <Selection ref={selectionRef} className="relative h-full w-full">
        {CATEGORIZE.map((item, index) => {
          return (
            <div
              key={item.id}
              className={cn(
                "text-[#363636] my-[10px]",
                index === 0 && "my-[2px]"
              )}
            >
              <div className="flex items-center gap-2 text-sm">
                <Checkbox id={item.name} />
                <Label
                  htmlFor={item.name}
                  className="text-[#111111] text-base font-medium"
                >
                  {item.name}
                </Label>
              </div>
              <div className="">
                {/* 截图和主图是一行2张，图标是一行6张 */}
                {item.id === "capture" && (
                  <div className="grid grid-cols-2 gap-2"></div>
                )}
                {item.id !== "capture" && <Category categoryId={item.id} />}
              </div>
            </div>
          );
        })}
      </Selection>
    </div>
  );
};
