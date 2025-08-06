import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { useShallow } from "zustand/shallow";

import { Button } from "@src/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@src/components/ui/dialog";
import { Input } from "@src/components/ui/input";
import { Label } from "@src/components/ui/label";
import { useWorkerZip } from "../inject/useZip";
import { useImageStore } from "@src/stores/image-stores";
import { perform } from "@src/pages/background/download";
import { getImageFromPage } from "../inject/download";
import { ICommunication } from "../inject/communicate";
import { generateDefaultZipName } from "@src/utils/utils";
import { cn } from "@src/lib/utils";
import { useI18n } from "@src/lib/hooks/useI18n";

export type ISaveDialog = {
  communication: React.RefObject<ICommunication>;
  disabledDownload: boolean;
  setDisabledDownload: React.Dispatch<React.SetStateAction<boolean>>;
  ref?: React.Ref<SaveDialogFunction>;
};

export type SaveDialogFunction = {
  open: () => void;
  close: () => void;
};

export const SaveDialog: React.FC<PropsWithChildren<ISaveDialog>> = ({
  ref,
  children,
  communication,
  disabledDownload,
  setDisabledDownload,
}) => {
  const { selectedImages } = useImageStore(
    useShallow((store) => ({
      selectedImages: store.selectedImages,
    }))
  );
  const t = useI18n();
  const { zip, completeCount } = useWorkerZip();

  useImperativeHandle(
    ref,
    (): SaveDialogFunction => ({
      open: () => {
        setOpen(true);
        // 显示弹框直接开始下载数据
        onZipDownload();
      },
      close: () => {
        setOpen(false);
      },
    })
  );

  const [open, setOpen] = useState(false);
  const [saveFileName, setSaveFileName] = useState("");
  // 进入此功能开始下载数据，但是当confirm 设置为true时才会下载到磁盘
  const [confirm, setConfirm] = useState(false);
  // 是否处理完成
  const [isSuccess, setIsSuccess] = useState(false);

  // 生成默认压缩包名称
  useEffect(() => {
    if (!open) return;
    else setSaveFileName("");
    (async () => {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tab = tabs[0];
      const url = tab?.url || "";

      const defaultZipName = generateDefaultZipName(url);
      setSaveFileName(defaultZipName);
    })();
  }, [open]);

  /**
   * 在浏览器内下载数据并压缩
   * 在任意iframe中请求正确的Referer通过fetch接口下载数据
   * 下载成功后返回数据再执行压缩方法
   */
  const onZipDownload = useCallback(async () => {
    // 获得当前已选中的images
    const selectedImages = useImageStore.getState().getSelectedImages?.();
    if (selectedImages && selectedImages.length > 0) {
      setDisabledDownload(true);
      zip.current?.postMessage(["start"]);
      await perform({ images: selectedImages }, async (filename, image) => {
        let content;
        try {
          content = await getImageFromPage(communication.current, image);
        } catch (e: any) {
          content = await new Blob([
            image.src + "\n\nCannot download image; " + e.message,
          ]).arrayBuffer();
          filename += ".txt";
        }
        const unit = new Uint8Array(content);
        zip.current?.postMessage(["addImage", filename, unit]);
        return 0;
      });
      // 压缩包制作好验证是否进入确认状态
      if (confirm) {
        zip.current?.postMessage(["done", saveFileName]);
        setDisabledDownload(false);
        // 重置确认状态
        setConfirm(false);
        setOpen(false);
      } else {
        setIsSuccess(true);
      }
    }
  }, [selectedImages, saveFileName]);

  const onSubmit = useCallback(() => {
    if (isSuccess) {
      zip.current?.postMessage(["done", saveFileName]);
      setDisabledDownload(false);
      setIsSuccess(false);
      setOpen(false);
    } else {
      setConfirm(true);
    }
  }, [isSuccess, saveFileName]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        className="sm:max-w-[425px]"
        onPointerDownOutside={() => {
          setDisabledDownload(false);
        }}
        onEscapeKeyDown={() => {
          setDisabledDownload(false);
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("dialog_title")}</DialogTitle>
          <DialogDescription>{t("dialog_description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3">
            <Label htmlFor="zip-name">{t("zip_label")}</Label>
            <Input
              id="zip-name"
              name="name"
              value={saveFileName}
              onChange={(e) => setSaveFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.code === "Enter") {
                  e.currentTarget.blur();
                  setOpen(false);
                }
              }}
              className={cn(
                saveFileName.length === 0 && " border border-orange-700"
              )}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("cancel")}</Button>
          </DialogClose>
          <Button disabled={saveFileName.length === 0} onClick={onSubmit}>
            {t("download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
