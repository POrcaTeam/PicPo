import { useMemo } from "React";
import { useShallow } from "zustand/shallow";

import { Progress as ProgressBar } from "@src/components/ui/progress";
import { useImageStore } from "@src/stores/image-stores";
import { cn } from "@src/lib/utils";
import { useI18n } from "@src/lib/hooks/useI18n";

export const Download = () => {
  const { download_progress } = useImageStore(
    useShallow((store) => ({
      download_progress: store.download_progress,
    }))
  );
  const t = useI18n();

  const percent = useMemo(() => {
    if (download_progress.done === "downloading") {
      const percent =
        Math.round(
          (download_progress.finished_num * 10000) / download_progress.all_num
        ) / 100;
      return percent;
    } else {
      return 100;
    }
  }, [download_progress]);

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
