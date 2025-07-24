import { useMemo, useCallback, useState, useRef } from "react";
import { ImageDown } from "lucide-react";
import { size } from "es-toolkit/compat";
import { useShallow } from "zustand/shallow";
import { CheckedState } from "@radix-ui/react-checkbox";

import { Button } from "@src/components/ui/button";
import { Checkbox } from "@src/components/ui/checkbox";
import { Label } from "@src/components/ui/label";
import { useImageStore } from "@src/stores/image-stores";
import { DownloadType } from "@src/pages/background/download";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@src/components/ui/dropdown-menu";
import { ICommunication } from "../inject/communicate";
import { SaveDialog, SaveDialogFunction } from "./save-dialog";

export const Action = (props: {
  onCheckedChange: (checked: boolean) => void;
  // 消息发送实例，可以往任意iframe发送消息，为惰性实例，需要主动调用使用
  communication: React.RefObject<ICommunication>;
}) => {
  const { selectedImages, images } = useImageStore(
    useShallow((store) => ({
      selectedImages: store.selectedImages,
      images: store.images,
    }))
  );

  const checked = useMemo(
    () => selectedImages.length === Object.keys(images).length,
    [selectedImages.length, Object.keys(images).length]
  );

  const onCheckedChange = useCallback((e: CheckedState) => {
    if (e) {
      useImageStore.getState().selectAll?.();
    } else {
      useImageStore.getState().clearSelected?.();
    }
    props.onCheckedChange(e as boolean);
  }, []);

  /**
   * 调用chrome方法直接下载数据
   */
  const onDownload = useCallback(() => {
    // 获得当前已选中的images
    const selectedImages = useImageStore.getState().getSelectedImages?.();

    if (selectedImages && Object.keys(selectedImages).length > 0) {
      setDisabledDownload(true);
      chrome.runtime.sendMessage<{
        cmd: string;
        type: DownloadType;
        images: Array<ImageEntry>;
      }>(
        {
          cmd: "downloads",
          type: DownloadType.FILES,
          images: selectedImages,
        },
        (_event) => {
          setDisabledDownload(false);
        }
      );
    }
  }, [images]);

  // 一次只能开启一个下载任务,当下载任务未完成时无法重复开启，防止阻塞
  const [disabledDownload, setDisabledDownload] = useState(false);

  const saveDialogRef = useRef<SaveDialogFunction>(null);
  return (
    <div className="flex flex-col flex-nowrap my-2">
      <div className="flex flex-row flex-1 items-center space-x-2 my-4">
        <div className="text-sm flex-1 text-[#363636]">
          发现 <span className="mx-0.5">{size(images)}</span>
          <span>张图片</span>
          <span>,</span>
          <span>已选中</span>
          <span className="mx-0.5">{selectedImages.length || 0} 张</span>
        </div>
      </div>
      <div className="flex flex-row flex-1 items-center space-x-2 px-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="selectAll"
            checked={checked}
            onCheckedChange={onCheckedChange}
          />
          <Label htmlFor="selectAll" className="text-[#111111] text-sm">
            全选
          </Label>
        </div>
        <div id="action_panel" className="flex-1"></div>
        <Button size="icon" className="cursor-pointer size-8"></Button>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              // disabled={selectedImages.length === 0 || disabledDownload}
              size="icon"
              className="cursor-pointer size-8"
            >
              <ImageDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={onDownload}
              disabled={selectedImages.length === 0 || disabledDownload}
            >
              下载图片到本地
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                saveDialogRef.current?.open();
              }}
              disabled={selectedImages.length === 0 || disabledDownload}
            >
              压缩下载到本地
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SaveDialog
        ref={saveDialogRef}
        communication={props.communication}
        disabledDownload={disabledDownload}
        setDisabledDownload={setDisabledDownload}
      />
    </div>
  );
};
