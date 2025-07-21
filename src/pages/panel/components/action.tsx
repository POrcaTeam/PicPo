import React, { useMemo, useCallback } from "react";
import { ImageDown } from "lucide-react";
import { size } from "es-toolkit/compat";
import { useShallow } from "zustand/shallow";
import { CheckedState } from "@radix-ui/react-checkbox";

import { Button } from "@src/components/ui/button";
import { Checkbox } from "@src/components/ui/checkbox";
import { Label } from "@src/components/ui/label";
import { useImageStore } from "@src/stores/image-stores";

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
  return (
    <div className="flex flex-nowrap my-2">
      <div className="flex flex-row flex-1 items-center space-x-2">
        <div className="text-sm flex-1 text-[#363636]">
          发现 <span className="mx-0.5">{size(images)}</span>/
          <span className="mx-0.5">{selectedImages.length || 0} 图片</span>
        </div>
        <Label className="hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-2 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950 cursor-pointer">
          <Checkbox
            id="toggle-2"
            checked={checked}
            className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
            onCheckedChange={onCheckedChange}
          />
          <div className="grid gap-1.5 font-normal">
            <p className="text-muted-foreground text-sm">选中所有图片</p>
          </div>
        </Label>
        <Button
          disabled={selectedImages.length === 0}
          size="icon"
          className="cursor-pointer"
        >
          <ImageDown className="size-4" />
        </Button>
      </div>
    </div>
  );
};
