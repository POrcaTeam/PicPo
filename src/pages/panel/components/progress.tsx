import { useMemo } from "React";
import { useShallow } from "zustand/shallow";

import { Progress as ProgressBar } from "@src/components/ui/progress";
import { useImageStore } from "@src/stores/image-stores";
import { cn } from "@src/lib/utils";
import { useI18n } from "@src/lib/hooks/useI18n";

export const Progress = () => {
  const { allLinks, progress } = useImageStore(
    useShallow((store) => ({
      allLinks: store.allLinks,
      progress: store.progress,
    }))
  );
  const t = useI18n();

  const percent = useMemo(() => {
    const p = progress ? progress : 0;
    const left = allLinks - p < 0 ? 0 : allLinks - p;

    const percent = Math.round((left * 10000) / allLinks) / 100;
    return percent;
  }, [allLinks, progress]);

  return (
    <div
      className={cn(
        "w-full flex my-[10px] mb-[5px] bg-white items-center px-2",
        percent === 100 && "hidden"
      )}
    >
      <div className="flex-1">
        <ProgressBar value={percent} className="w-full" />
      </div>
      <div className="flex-none ml-2 text-[#111111]">{t("collecting")}</div>
    </div>
  );
};
