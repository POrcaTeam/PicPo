import React, { useEffect, useState, useRef, useImperativeHandle } from "react";
import { SelectionArea, SelectionEvent } from "@viselect/react";

import { cn } from "@src/lib/utils";

import styles from "./image-selection.module.scss";
import { useImageStore } from "@src/stores/image-stores";
import { useShallow } from "zustand/shallow";

export type ImageFunction = {
  // 清空所有
  clear: () => void;
  // 选中所有
  selectedAll: () => void;
};
export const Selection: React.FC<{
  ref?: React.Ref<ImageFunction>;
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className, ref }) => {
  const { selectImage, clearSelected } = useImageStore(
    useShallow((store) => ({
      selectImage: store.selectImage,
      clearSelected: store.clearSelected,
    }))
  );

  useImperativeHandle(
    ref,
    (): ImageFunction => ({
      clear: () => {
        // 清空当前组件状态
        setSelected(() => new Set());
        selectionRef.current && selectionRef.current.clearSelection();
      },
      selectedAll: () => {
        //  todo
      },
    })
  );

  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const extractIds = (els: Element[]): string[] =>
    els
      .map((v) => v.getAttribute("data-key"))
      .filter(Boolean)
      .map(String);

  const selectionRef = useRef<any>(undefined);

  const onStart = ({ event, selection }: SelectionEvent) => {
    if (!selectionRef.current) selectionRef.current = selection;
    if (!event?.ctrlKey && !event?.metaKey) {
      selection.clearSelection();
      setSelected(() => new Set());
    }
  };

  const onMove = ({
    store: {
      changed: { added, removed },
    },
  }: SelectionEvent) => {
    setSelected((prev) => {
      const next = new Set(prev);
      extractIds(added).forEach((id) => next.add(id));
      extractIds(removed).forEach((id) => next.delete(id));
      return next;
    });
  };

  // 移动选择结束
  const onEnded = () => {};

  // 取消在输入框内的多选事件
  const onBeforeStart = ({ event }: SelectionEvent) => {
    return (
      (event?.target as any).tagName !== "INPUT" &&
      (event?.target as any).tagName !== "TEXTAREA"
    );
  };

  useEffect(() => {
    if (selected.size > 0) {
      let ids = Array.from(selected);
      selectImage?.(ids);
    } else {
      clearSelected?.();
    }
  }, [selected]);

  // 绑定事件监听点击到界面外某个元素取消选中
  const componentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // 点击到元素外，包括id="folder_items"||id="files-layout-datails"清空选中
    const handleClickOutside = (event: MouseEvent) => {
      if (!event.target) return;
      if (
        componentRef.current &&
        !componentRef.current.contains(event.target as any)
      ) {
        // 操作栏
        // let element = document.getElementById("action_panel");
        // if ((event.target as any).contains(element)) {
        //   setSelected(() => new Set());
        //   selectionRef.current && selectionRef.current.clearSelection();
        // }
      }
    };

    document.addEventListener("click", handleClickOutside, false);
    return () => {
      document.removeEventListener("click", handleClickOutside, false);
    };
  }, []);

  // 没有点击到元素清空选中
  const onClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      let target = e.target;
      // 是否是多选元素
      let hasMuti = (target as HTMLElement).hasAttribute("data-select-muti");
      // 如果不是多选元素清空当前选中项目
      // if (!hasMuti) {
      //   setSelected(() => new Set());
      //   selectionRef.current && selectionRef.current.clearSelection();
      // }
    },
    []
  );

  return (
    <div className="select-none" ref={componentRef} onClick={onClick}>
      <SelectionArea
        className={cn("h-full w-full", className)}
        selectables=".selectable"
        startAreas={["#files-scrollbar"]}
        boundaries={["#files-scrollbar"]}
        selectionAreaClass={styles["selection-area"]}
        selectionContainerClass={styles["selection-area-container"]}
        onBeforeStart={onBeforeStart}
        onStart={onStart}
        onMove={onMove}
        onEnded={onEnded}
      >
        {children}
      </SelectionArea>
    </div>
  );
};
