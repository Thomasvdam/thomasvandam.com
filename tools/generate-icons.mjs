import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { URL } from "node:url";
import { ImageResponse } from "next/og.js";
import React from "react";

const source = new URL("../app/icon.svg", import.meta.url);
const svg = await readFile(source);
const image = `data:image/svg+xml;base64,${svg.toString("base64")}`;

async function render(size) {
  const response = new ImageResponse(
    React.createElement("img", { src: image, width: size, height: size }),
    { width: size, height: size },
  );

  return Buffer.from(await response.arrayBuffer());
}

const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(render));
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);

let offset = directory.length;
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16;
  directory.writeUInt8(size, entry);
  directory.writeUInt8(size, entry + 1);
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(images[index].length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
}

await writeFile(new URL("../app/favicon.ico", import.meta.url), Buffer.concat([directory, ...images]));
await writeFile(new URL("../app/apple-icon.png", import.meta.url), await render(180));
