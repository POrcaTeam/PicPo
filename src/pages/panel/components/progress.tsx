import { useMemo } from "React";
import { Progress as ProgressBar } from "@src/components/ui/progress";
import { useImageStore } from "@src/stores/image-stores";
import { useShallow } from "zustand/shallow";
import { cn } from "@src/lib/utils";

export const Progress = () => {
  const { allLinks, progress } = useImageStore(
    useShallow((store) => ({
      allLinks: store.allLinks,
      progress: store.progress,
    }))
  );

  const percent = useMemo(() => {
    const p = progress ? progress : 0;
    const left = allLinks - p < 0 ? 0 : allLinks - p;

    const percent = Math.round((left * 10000) / allLinks) / 100;
    return percent;
  }, [allLinks, progress]);

  return (
    <div className={cn("w-full flex bg-white", percent === 100 && "hidden")}>
      <div className="flex-1 px-2">
        <ProgressBar value={percent} className="w-full" />
      </div>
    </div>
  );
};
