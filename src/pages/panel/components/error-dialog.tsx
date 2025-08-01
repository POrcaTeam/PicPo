import { PropsWithChildren, useImperativeHandle, useState } from "react";
import { useI18n } from "@src/lib/hooks/useI18n";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@src/components/ui/dialog";
import { Button } from "@src/components/ui/button";
import { TriangleAlert } from "lucide-react";

export type IErrorDialog = {
  ref?: React.Ref<ErrorDialogFunction>;
};
export type ErrorDialogFunction = {
  open: (message: string) => void;
  close: () => void;
};

export const ErrorDialog: React.FC<PropsWithChildren<IErrorDialog>> = ({
  ref,
  children,
}) => {
  const [message, setMessage] = useState<string>("error");
  const [open, setOpen] = useState(false);

  const t = useI18n();
  useImperativeHandle(
    ref,
    (): ErrorDialogFunction => ({
      // 接收消息并显示
      open: (message: string) => {
        setOpen(true);
        setMessage(t(message));
      },
      close: () => {
        setOpen(false);
      },
    })
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center flex-row flex-nowrap sm:justify-start justify-center">
              <TriangleAlert className=" text-red-500 mr-1 size-5" />
              {t("dialog_error_title")}
            </div>
          </DialogTitle>
          <DialogDescription>{t("dialog_error_description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="text-[#111111] text-base">{message}</div>
        </div>
        <DialogFooter>
          <Button
            className="cursor-pointer w-full"
            onClick={() => {
              setOpen(false);
            }}
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
