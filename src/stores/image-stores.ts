import { StoreApi, UseBoundStore, create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { union, difference } from "es-toolkit";
import { filter, map } from "es-toolkit/compat";
import { Utils } from "@src/utils/utils";
import { classifyImage } from "@src/classify";

export type ImageStates = {
  // 所有检测到的links 数量
  allLinks: number;
  // 图片集合
  images: Record<string, ImageEntry>;
  // 检测到的frame数量
  allFrames: number;
  // progress
  progress: number | undefined;
  // 被选中的图片
  selectedImages: Array<string>;
  // 过滤后的图片集合
  filterImages: Record<string, ImageEntry>;
};

export type ActionStates = {
  // 添加图片
  addImages: (images: Array<ImageEntry>) => void;
  // 添加links
  addLinks: (count?: number) => number;
  // 添加frames
  addFrames: (count?: number) => void;
  // 设置progress进度
  setProgress: (p: number) => void;
  // 选中图片
  selectImage: (imageIds: Array<string>) => void;
  // 新增选中图片
  addSelectImage: (imageIds: Array<string>) => void;
  // 取消选中图片
  removeSelectImage: (imageIds: Array<string>) => void;
  // 取消选中图片
  unSelectImage: (imageIds: Array<string>) => void;
  // 清空选中的图片
  clearSelected: () => void;
  // 全部选中
  selectAll: () => void;
  // 获得选中的图片实例
  getSelectedImages: () => Array<ImageEntry>;
  // 设置过滤后的数据
  setFilterImages: (images: Record<string, ImageEntry>) => void;
};

export type ImageStore = ImageStates & Partial<ActionStates>;

export const initImageStore = (): ImageStore => {
  return {
    allLinks: 0,
    images: {},
    allFrames: 0,
    progress: undefined,
    selectedImages: [],
    filterImages: {},
  };
};

// 根据对象生成稳定hash
/**
 * 对任意 JS 对象生成稳定的哈希值
 * 使用 JSON 序列化 + Web Crypto API 生成 SHA-256 哈希
 */
export async function hashObject(obj: any): Promise<string> {
  // 1. 稳定序列化对象（确保 key 顺序不影响结果）
  const stableStringify = (value: any): string => {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return "[" + value.map(stableStringify).join(",") + "]";
    }

    const keys = Object.keys(value).sort(); // 保证 key 有序
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + stableStringify(value[k]))
        .join(",") +
      "}"
    );
  };

  const json = stableStringify(obj);

  // 2. 编码为 Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(json);

  // 3. 使用 SubtleCrypto 生成 SHA-256 哈希
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // 4. 转为十六进制字符串
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

const useImageStoreBase = create<ImageStore>()(
  immer((set, get) => ({
    ...initImageStore(),
    addImages: async (images: Array<ImageEntry>) => {
      const originImages = get().images;
      images.forEach(async (image) => {
        if (!image) return;
        //   if (!image.size) {
        //     console.warn("image size is zero:", image);
        //     return;
        //   }

        // 生成filename
        let guessName = "";
        if (image.type?.startsWith("image/")) {
          try {
            image.hostname = new URL(image.src).hostname;
          } catch (e) {}

          image.hostname = image.hostname || "local";

          const { filename, name } = Utils.guess(
            image,
            "", // 生成文件名规则
            true
          );
          image.filename = filename;
          guessName = name;
        }
        // 加入时去重复
        // 加入时根据大小、尺寸生成hash，用hash来作为图片的唯一Key
        // 重复判定规则为判定hash是否重复，如果重复不添加
        const hash = await hashObject({
          guessName,
          width: image.width || 0,
          height: image.height || 0,
          size: image.size,
          type: image.type,
        });
        image.categorize = classifyImage(image);
        if (!originImages[hash]) {
          set((draft) => {
            draft.images[hash] = image;
          });
        }
      });
    },
    addLinks: (count?: number) => {
      let allLinks = 0;
      count = count ? count : 1;
      set((draft) => {
        allLinks = draft.allLinks + count;
        draft.allLinks = allLinks;
      });
      return allLinks;
    },
    setProgress: (p: number) => {
      set((draft) => {
        draft.progress = p;
      });
    },
    selectImage: (imageIds) => {
      const images = get().images;
      // 判断在images是否包含此数据id
      const filterResult = imageIds.filter((id) => {
        return images[id];
      });
      set((draft) => {
        draft.selectedImages = filterResult;
      });
    },
    addSelectImage: (imageIds) => {
      const images = get().images;
      const filterResult = imageIds.filter((id) => {
        return images[id];
      });
      set((draft) => {
        draft.selectedImages = [...union(draft.selectedImages, filterResult)];
      });
    },
    removeSelectImage: (imageIds) => {
      const images = get().images;
      const filterResult = imageIds.filter((id) => {
        return images[id];
      });
      set((draft) => {
        draft.selectedImages = [
          ...difference(draft.selectedImages, filterResult),
        ];
      });
    },
    unSelectImage: (imageIds) => {
      set((draft) => {
        draft.selectedImages = difference(draft.selectedImages, imageIds);
      });
    },
    selectAll: () => {
      const resultIds = map(get().images, (_image, key) => key);
      set((draft) => {
        draft.selectedImages = resultIds;
      });
    },
    clearSelected: () => {
      set((draft) => {
        draft.selectedImages = [];
      });
    },
    getSelectedImages: () => {
      const images = get().images;
      const selectedImages = get().selectedImages;
      return filter(
        images,
        (_image, key) => selectedImages.indexOf(key) !== -1
      );
    },
    setFilterImages: (images) => {
      set((draft) => {
        draft.filterImages = images;
      });
    },
  }))
);

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S
) => {
  let store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (let k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

export const useImageStore = createSelectors(useImageStoreBase);
