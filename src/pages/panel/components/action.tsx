import { useMemo, useCallback } from "react";
import { ImageDown } from "lucide-react";
import { find, size } from "es-toolkit/compat";
import { useShallow } from "zustand/shallow";
import { CheckedState } from "@radix-ui/react-checkbox";

import { Button } from "@src/components/ui/button";
import { Checkbox } from "@src/components/ui/checkbox";
import { Label } from "@src/components/ui/label";
import { useImageStore } from "@src/stores/image-stores";
import { DownloadType } from "@src/pages/background/download";

export const Action = (props: {
  onCheckedChange: (checked: boolean) => void;
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

  const onDownload = useCallback(() => {
    // 获得当前已选中的images
    const selectedImages = useImageStore.getState().getSelectedImages?.();

    if (selectedImages && Object.keys(selectedImages).length > 0) {
      chrome.runtime.sendMessage<{
        cmd: string;
        type: DownloadType;
        images: Array<ImageEntry>;
      }>({
        cmd: "downloads",
        type: DownloadType.FILES,
        images: selectedImages,
      });
    }
  }, [images]);
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
        <div className="flex-1"></div>
        <Button size="icon" className="cursor-pointer size-8"></Button>
        <Button
          disabled={selectedImages.length === 0}
          size="icon"
          className="cursor-pointer size-8"
          onClick={onDownload}
        >
          <ImageDown className="size-4" />
        </Button>
      </div>
    </div>
  );
};
