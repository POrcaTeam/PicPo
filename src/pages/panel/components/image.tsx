import { useMemo } from "react";
import { filesize } from "filesize";

import { cn } from "@src/lib/utils";
import { useImageStore } from "@src/stores/image-stores";

import SelectImg from "@assets/img/select.svg";

export const Image = ({
  image,
  id,
  category,
}: {
  image: ImageEntry;
  id: string;
  category: string;
}) => {
  const selectedImages = useImageStore((store) => store.selectedImages);

  const isSelected = useMemo(() => {
    return selectedImages.indexOf(id) !== -1;
  }, [id, selectedImages]);
  return (
    <div
      data-key={id}
      className={cn(
        "selectable relative flex flex-col items-center transition-shadow duration-100 cursor-pointer group rounded-t-sm",
        "hover:shadow-[0px_0px_6px_2px_#89F384]",
        isSelected ? "shadow-[0px_0px_2px_2px_#89F384]" : ""
      )}
      style={{ contain: "paint" }}
      data-select-muti
    >
      <div
        className={cn(
          "absolute top-2 right-2 hidden z-50",
          isSelected && "block"
        )}
      >
        <img src={SelectImg} alt="selected" className="size-6" />
      </div>
      <div
        className={cn(
          "absolute top-2 left-2 text-sm text-white flex flex-col space-y-2"
        )}
        data-select-muti
      >
        <div
          className={cn(
            "rounded-sm bg-neutral-900/55 px-1 py-0.5 hidden",
            category === "main" && "block"
          )}
        >
          {image.type}
        </div>
        <div
          className={cn(
            "rounded-sm bg-neutral-900/55 px-0.5 py-0.5 text-xs w-fit",
            category === "icon" && "bg-neutral-900/35"
          )}
        >
          {filesize(image.size || 0)}
        </div>
      </div>
      <div
        className={cn(
          "relative bg-gray-200 h-auto flex flex-col items-center justify-center rounded-md aspect-squarew w-full min-h-20 max-h-[205px]"
        )}
        style={{ height: "-webkit-fill-available" }}
        data-select-muti
      >
        <div
          className={cn(
            "absolute h-full w-full top-0 left-0",
            isSelected && "bg-[#b4b4b42e]"
          )}
        />
        <img
          src={image.src}
          alt={image.alt}
          loading="eager"
          decoding="async"
          draggable="false"
          referrerPolicy="no-referrer"
          className={cn(
            "bg-gray-200 object-contain h-full w-auto p-0",
            category !== "main" && "h-full p-4"
          )}
          data-select-muti
        />
      </div>
      <div
        className={cn(
          "w-full hidden mt-1",
          (category === "main" || category === "capture") && "block"
        )}
      >
        <div className="text-[#3b3b3b]">
          {image.width} X {image.height}
        </div>
      </div>
    </div>
  );
};
