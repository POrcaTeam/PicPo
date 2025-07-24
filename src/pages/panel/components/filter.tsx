import { useEffect, useState } from "react";
import { useShallow } from "zustand/shallow";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@src/components/ui/select";
import { IShape, ISize, IType, useFilterStore } from "@src/stores/filter-store";
import { useImageStore } from "@src/stores/image-stores";
import { X } from "lucide-react";
import { Button } from "@src/components/ui/button";

const regex = {
  PNG: /\/png$/i,
  JPG: /\/jpe?g$/i,
  GIF: /\/gif$/i,
  BMP: /\/bmp$/i,
  SVG: /^image\/svg\+xml$|^image\/svg$|^svg$/i,
  WEBP: /\/webp$/i,
  ICO: /\ico$/i,
  AVIF: /\avif$/i,
  TIFF: /\tiff$/i,
};

export const Filter = () => {
  const { setFilterImages, images } = useImageStore(
    useShallow((store) => ({
      setFilterImages: store.setFilterImages,
      images: store.images,
    }))
  );
  const { shape, size, type, setShape, setSize, setType } = useFilterStore(
    useShallow((store) => store)
  );

  useEffect(() => {
    const images = useImageStore.getState().images;
    const filtered = Object.fromEntries(
      Object.entries(images).filter(([key, image]) => {
        const fileWidth = image.width || 0;
        const fileHeight = image.height || 0;
        if (size) {
          // 150以下为小图，总像素22,500
          // 500以下为中,总像素250,000
          // 大于500为大图
          const pixel = fileWidth * fileHeight;
          if (size === "small") {
            if (pixel > 22500) {
              return false;
            }
          } else if (size === "medium") {
            if (pixel <= 22500 && pixel > 250000) {
              return false;
            }
          } else if (size === "large") {
            if (pixel <= 250000) {
              return false;
            }
          }
        }
        if (type) {
          const fileType = image.type?.toLowerCase() || "";
          const regexA = regex[type];
          if (!regexA.test(fileType)) {
            return false;
          }
        }
        if (shape) {
          // 避免出现分母为0，设置0.1
          const fileShape = image.width || 0 / (image.height || 0.1);

          if (shape === "square") {
            if (fileShape !== 1) {
              return false;
            }
          } else if (shape === "wide") {
            if (fileShape <= 1) {
              return false;
            }
          } else if (shape === "rectangle") {
            if (fileShape >= 1) {
              return false;
            }
          }
        }
        return true;
      })
    );

    setFilterImages?.(filtered);
  }, [shape, size, type, images]);

  const [sizeOpen, setSizeOpenOpen] = useState(false);
  return (
    <div className="flex flex-row flex-nowrap space-x-2">
      <Select
        value={size}
        onValueChange={(e) => {
          setSize?.(e as ISize);
        }}
      >
        <SelectTrigger size="sm" className="w-auto flex-1 !text-[#111111]">
          <SelectValue placeholder="图象尺寸" />
          {size && (
            <Button
              className="p-0 size-5 cursor-pointer pointer-events-auto mx-[-5px]"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setSize?.("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>图像尺寸</SelectLabel>
            <SelectItem value="small" aria-label="small">
              小
            </SelectItem>
            <SelectItem value="medium" aria-label="medium">
              中
            </SelectItem>
            <SelectItem value="large" aria-label="large">
              大
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        value={type}
        onValueChange={(e) => {
          setType?.(e as IType);
        }}
      >
        <SelectTrigger size="sm" className="w-auto flex-1 !text-[#111111]">
          <SelectValue placeholder="图片类型" />
          {type && (
            <Button
              className="p-0 size-5 cursor-pointer pointer-events-auto mx-[-5px]"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setType?.("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>图片类型</SelectLabel>
            <SelectItem value="JPG" aria-label="JPG">
              JPG
            </SelectItem>
            <SelectItem value="GIF" aria-label="GIF">
              GIF
            </SelectItem>
            <SelectItem value="PNG" aria-label="PNG">
              PNG
            </SelectItem>
            <SelectItem value="BMP" aria-label="BMP">
              BMP
            </SelectItem>
            <SelectItem value="SVG" aria-label="SVG">
              SVG
            </SelectItem>
            <SelectItem value="WEBP" aria-label="WEBP">
              WEBP
            </SelectItem>
            <SelectItem value="ICO" aria-label="ICO">
              ICO
            </SelectItem>
            <SelectItem value="TIFF" aria-label="TIFF">
              TIFF
            </SelectItem>
            <SelectItem value="AVIF" aria-label="AVIF">
              AVIF
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        value={shape}
        onValueChange={(e) => {
          setShape?.(e as IShape);
        }}
      >
        <SelectTrigger size="sm" className="w-auto flex-1 !text-[#111111]">
          <SelectValue placeholder="图像形状" />
          {shape && (
            <Button
              className="p-0 size-5 cursor-pointer pointer-events-auto mx-[-5px]"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShape?.("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>图像形状</SelectLabel>
            <SelectItem value="square" aria-label="square">
              方图
            </SelectItem>
            <SelectItem value="wide" aria-label="wide">
              宽图
            </SelectItem>
            <SelectItem value="rectangle" aria-label="rectangle">
              长图
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};
