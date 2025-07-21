import { useMemo } from "react";
import { filesize } from "filesize";

import { cn } from "@src/lib/utils";
import { useImageStore } from "@src/stores/image-stores";

export const Image = ({ image, id }: { image: ImageEntry; id: string }) => {
  const selectedImages = useImageStore((store) => store.selectedImages);

  const isSelected = useMemo(() => {
    return selectedImages.indexOf(id) !== -1;
  }, [id, selectedImages]);
  return (
    <div
      data-key={id}
      className={cn(
        "selectable bg-gray-200 h-30 flex items-center justify-center rounded-md transition-shadow duration-100 hover:shadow-[0px_0px_6px_2px_#89F384]",
        isSelected ? "bg-[#89F384] shadow-[0px_0px_6px_2px_#89F384]" : ""
      )}
      style={{ contain: "paint" }}
    >
      <div
        className={cn(
          "absolute top-2 left-2 text-sm text-white flex flex-col space-y-2"
        )}
      >
        <div className="rounded-sm bg-neutral-900/55 px-1 py-0.5">
          {image.type}
        </div>
        <div className="rounded-sm bg-neutral-900/55 px-0.5 py-0.5 text-xs w-fit">
          {filesize(image.size || 0)}
        </div>
      </div>
      <img
        src={image.src}
        alt={image.alt}
        loading="eager"
        decoding="async"
        draggable="false"
        referrerPolicy="no-referrer"
        className="bg-gray-200 object-contain h-full w-auto p-0 rounded-md"
      />
    </div>
  );
};
