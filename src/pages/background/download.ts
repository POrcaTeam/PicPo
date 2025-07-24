// 数据下载模块

// 下载方式
export enum DownloadType {
  FILES = 0, // 按文件下载
  ZIPFILE = 1, // 按压缩包下载
  PICORCA = 2, // 下载到picorca
}
// 下载配置
type IDownloadOption = {
  // 是否保存到选定目录下
  directory: boolean;
  // zip 文件名称
  zipFileName: string;
  // 是否生成readme文件
  readme: boolean;
  // 是否保存zip文件(如果不保存为zip保存为图片文件)
  zip: boolean;
};

type RequestData = {
  images: ImageEntry[];
  option?: IDownloadOption;
};

const DEFAULT_DOWNLOAD_OPTION: IDownloadOption = {
  directory: false,
  zipFileName: "test.zip",
  readme: false,
  zip: true,
};

// 下载数据方法
export const downloadImages = (request: RequestData) => {
  return new Promise((resolve) => {
    const { option } = request;

    const assignOption = { ...DEFAULT_DOWNLOAD_OPTION, ...option };
    perform(request, (filename, image) => {
      return nativeDownload({
        url: image.src,
        filename: image.filename,
        conflictAction: "uniquify",
        saveAs: false,
      });
    }).then((es) => {
      resolve(es);
    });
  });
};

export const perform = async (
  request: RequestData,
  callback: (filename: string, image: ImageEntry) => Promise<number>
): Promise<void> => {
  const indices: Record<string, number> = {};

  const prefs: {
    // 下载延迟
    "download-delay": number;
    // 同一时间进行的任务数
    "download-number": number;
  } = await new Promise((resolve) =>
    chrome.storage.local.get(
      {
        "download-delay": 100,
        "download-number": 5,
      },
      resolve
    )
  );

  for (let n = 0; n < request.images.length; n += prefs["download-number"]) {
    // 计算下载进度
    const download_percent = ((n / request.images.length) * 100).toFixed(0);
    console.log(download_percent);

    await Promise.all(
      [...Array(prefs["download-number"])].map(async (_, i) => {
        const image = request.images[i + n];
        if (!image) return;

        // Generate filename
        let filename =
          image.filename || Math.random().toString(36).substring(2, 15);
        indices[filename] = (indices[filename] || 0) + 1;

        if (indices[filename] > 1) {
          if (/\.([^.]{1,6})$/.test(filename)) {
            filename = filename.replace(
              /\.([^.]{1,6})$/,
              (_, ext) => ` (${indices[filename] - 1}).${ext}`
            );
          } else {
            filename += ` (${indices[filename] - 1})`;
          }
        }

        await callback(filename, image);
      })
    );

    await new Promise((resolve) =>
      setTimeout(resolve, prefs["download-delay"])
    );
  }
};

/**
 * 借助Chrome下载方法下载文件
 * @param options @type {chrome.downloads.DownloadOptions} 配置项
 * @param filename
 * @returns
 */
export const nativeDownload = (
  options: chrome.downloads.DownloadOptions,
  filename = "images.zip"
): Promise<number> =>
  new Promise((resolve) =>
    chrome.downloads.download(options, (id) => {
      if (chrome.runtime.lastError) {
        options.filename = filename;
        chrome.downloads.download(options, resolve);
      } else {
        resolve(id);
      }
    })
  );
