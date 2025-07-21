import { SquareBottomDashedScissors } from "lucide-react";
import { useRef, useEffect, useImperativeHandle } from "react";
import { filesize } from "filesize";
import { map } from "es-toolkit/compat";

import { Checkbox } from "@src/components/ui/checkbox";
import { ImageFunction, Selection } from "./image-selection";
import { Label } from "@src/components/ui/label";
import { cn } from "@src/lib/utils";
import { Button } from "@src/components/ui/button";
import { useImageStore } from "@src/stores/image-stores";
import { Image } from "./image";

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
  const images = useImageStore((store) => store.images);
  console.log(images);
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
        {CATEGORIZE.map((item) => {
          return (
            <div key={item.id} className="text-[#363636] my-3">
              <div className="flex items-center gap-3 text-sm">
                <Checkbox id={item.name} />
                <Label htmlFor={item.name}>{item.name}</Label>
                {item.id === "capture" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="cursor-pointer"
                    onClick={onScreenShoot}
                  >
                    <SquareBottomDashedScissors className="size-4 cursor-pointer text-emerald-600" />
                  </Button>
                )}
              </div>
              <div className={cn(item.id !== "capture" && "mt-3")}>
                {/* 截图和主图是一行2张，图标是一行6张 */}
                {item.id === "capture" && (
                  <div className="grid grid-cols-2 gap-2"></div>
                )}
                {item.id === "primary" && (
                  <div className="grid grid-cols-2 gap-2">
                    {map(images, (image, key) => {
                      return <Image image={image} key={key} id={key} />;
                    })}
                  </div>
                )}
                {item.id !== "capture" && item.id !== "primary" && (
                  <div className="grid grid-cols-5"></div>
                )}
              </div>
            </div>
          );
        })}
      </Selection>
    </div>
  );
};
