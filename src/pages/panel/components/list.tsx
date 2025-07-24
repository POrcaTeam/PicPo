import { useRef, useEffect, useImperativeHandle, useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { keys } from "es-toolkit/compat";

import { Checkbox } from "@src/components/ui/checkbox";
import { Label } from "@src/components/ui/label";
import { useImageStore } from "@src/stores/image-stores";
import { cn } from "@src/lib/utils";
import { ImageFunction, Selection } from "./image-selection";
import { Category } from "../category";

const CATEGORIZE = [
  {
    id: "capture",
    name: chrome.i18n.getMessage("list_capture"),
  },
  {
    id: "main",
    name: chrome.i18n.getMessage("list_main"),
  },
  {
    id: "icon",
    name: chrome.i18n.getMessage("list_icon"),
  },
  {
    id: "others",
    name: chrome.i18n.getMessage("list_others"),
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
  const { addSelectImage, removeSelectImage } = useImageStore(
    useShallow((store) => ({
      addSelectImage: store.addSelectImage,
      removeSelectImage: store.removeSelectImage,
    }))
  );

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
    }
  };
  useEffect(() => {
    chrome.runtime.onMessage.addListener(onChange);
    return () => {
      chrome.runtime.onMessage.removeListener(onChange);
    };
  }, []);

  const onGroupCheck = useCallback((id: string, type: boolean) => {
    const images = useImageStore.getState().images;
    const filtered = Object.fromEntries(
      Object.entries(images).filter(([_key, image]) => image.categorize === id)
    );

    const filteredKeys = keys(filtered);

    if (type) {
      addSelectImage?.(filteredKeys);
    } else {
      removeSelectImage?.(filteredKeys);
    }
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
                <Checkbox
                  id={item.name}
                  onCheckedChange={(e) => {
                    onGroupCheck(item.id, Boolean(e));
                  }}
                />
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
