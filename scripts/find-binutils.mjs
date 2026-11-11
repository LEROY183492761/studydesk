const base = 'https://mirrors.tuna.tsinghua.edu.cn/msys2/mingw/mingw64/';

const response = await fetch(base);
if (!response.ok) {
  throw new Error(`directory request failed: ${response.status}`);
}

const html = await response.text();
const names = [...html.matchAll(/href="(mingw-w64-x86_64-binutils-[^"]+\.pkg\.tar\.zst)"/g)].map(
  (match) => match[1],
);

console.log(names.join('\n'));