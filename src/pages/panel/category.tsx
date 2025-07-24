import { useImageStore } from "@src/stores/image-stores";
import { map } from "es-toolkit/compat";
import { Image } from "./components/image";
import React from "react";

export const Category = React.memo(({ categoryId }: { categoryId: string }) => {
  const images = useImageStore((store) => store.filterImages);
  return (
    <div>
      {categoryId === "main" && (
        <div className="grid grid-cols-2 gap-2 mt-[10px]">
          {map(images, (image, key) => {
            if (image.categorize === "main") {
              return (
                <Image
                  image={image}
                  key={key}
                  id={key}
                  category={image.categorize}
                />
              );
            }
          })}
        </div>
      )}
      {categoryId === "icon" && (
        <div className="grid grid-cols-[repeat(5,minmax(70px,1fr))] gap-2 mt-[10px] max-[430px]:grid-cols-[repeat(4,minmax(70px,1fr))]">
          {map(images, (image, key) => {
            if (image.categorize === "icon") {
              return (
                <Image
                  image={image}
                  key={key}
                  id={key}
                  category={image.categorize}
                />
              );
            }
          })}
        </div>
      )}
      {categoryId !== "main" && categoryId !== "icon" && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-2 mt-[10px]">
          {map(images, (image, key) => {
            if (image.categorize === "other") {
              return (
                <Image
                  image={image}
                  key={key}
                  id={key}
                  category={image.categorize}
                />
              );
            }
          })}
        </div>
      )}
    </div>
  );
});
