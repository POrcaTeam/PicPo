// 图片分类
export function classifyImage(image: ImageEntry): "main" | "icon" | "other" {
  const ext = image.filename?.toLowerCase();
  let isRaster = false;
  let isSvg = false;
  if (ext) {
    isRaster = /\.(png|jpg|jpeg|gif|bmp|webp|heif)$/.test(ext);
    isSvg = ext.includes("svg");
  }

  const maxSide = Math.max(image.width || 0, image.height || 0);
  const minSide = Math.min(image.width || 0, image.height || 0);

  // 规则 1: 主图
  if (isRaster && maxSide > 200) {
    return "main";
  }
  if (isSvg && maxSide > 150) {
    return "main";
  }

  // 规则 2: 图标
  if (isSvg && maxSide <= 150) {
    return "icon";
  }

  // 规则 3: 其他
  return "other";
}
