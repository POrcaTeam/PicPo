interface ImageEntry {
  name?: string; // 文件名称
  src: string; // 资源的源路径
  alt?: string;
  width?: number;
  height?: number;
  size?: number;
  type?: string;
  verified?: boolean;
  page: string; // 资源所在的页面路径
  custom?: string;
  hostname?: string; // 资源所在host地址
  filename?: string; // 文件名称
  meta: {
    origin: string;
    size?: string;
    type?: string;
  };
  position?: number; // 资源序号
  disposition?: string;
  categorize?: "main" | "icon" | "others";
  frameId?: number; // 图片所在的iframe页面的id,内部数据下载使用
}

interface DocumentEntry {
  src: string;
  meta: {
    origin: string;
  };
}

interface MetaResult {
  meta: {
    type: string;
    [key: string]: any;
  };
  origin: string;
}

interface Policies {
  bg: boolean;
  links: boolean;
  extract: boolean;
}

interface Utils {
  EXTENSIONS: Record<string, string>;
  response: {
    heads(o: ImageEntry): Promise<any>;
    segment(o: ImageEntry): Promise<any>;
    text(o: DocumentEntry): Promise<string>;
  };
  type(a?: any, b?: any): string;
}
