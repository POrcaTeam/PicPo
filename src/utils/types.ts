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
  meta: {
    origin: string;
    size?: string;
    type?: string;
  };
  position?: number;
  disposition?: string;
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
