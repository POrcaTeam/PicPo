import { Button } from "@src/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@src/components/ui/select";
import React from "react";

export const Filter = () => {
  return (
    <div className="flex flex-row flex-nowrap space-x-2">
      <Select>
        <SelectTrigger size="sm" className="w-auto flex-1">
          <SelectValue placeholder="图象尺寸" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>图像尺寸</SelectLabel>
            <SelectItem value="small">小</SelectItem>
            <SelectItem value="medium">中</SelectItem>
            <SelectItem value="large">大</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger size="sm" className="w-auto flex-1">
          <SelectValue placeholder="图片类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>图片类型</SelectLabel>
            <SelectItem value="small">所有</SelectItem>
            <SelectItem value="medium">JPG</SelectItem>
            <SelectItem value="large">GIF</SelectItem>
            <SelectItem value="medium">PNG</SelectItem>
            <SelectItem value="large">BMP</SelectItem>
            <SelectItem value="medium">SVG</SelectItem>
            <SelectItem value="large">WEBP</SelectItem>
            <SelectItem value="medium">ICO</SelectItem>
            <SelectItem value="large">TIFF</SelectItem>
            <SelectItem value="large">AVIF</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger size="sm" className="w-auto flex-1">
          <SelectValue placeholder="图像形状" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>图像形状</SelectLabel>
            <SelectItem value="small">方图</SelectItem>
            <SelectItem value="medium">宽图</SelectItem>
            <SelectItem value="large">长图</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};
