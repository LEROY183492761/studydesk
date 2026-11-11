import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cargoHome = path.join(root, '.toolchain', 'cargo');
const rustupHome = path.join(root, '.toolchain', 'rustup');
const cargoBin = path.join(cargoHome, 'bin');
const selfContained = path.join(
  rustupHome,
  'toolchains',
  'stable-x86_64-pc-windows-gnu',
  'lib',
  'rustlib',
  'x86_64-pc-windows-gnu',
  'bin',
  'self-contained',
);
const binutilsBin = path.join(root, '.toolchain', 'binutils', 'mingw64', 'bin');
const dlltoolShim = path.join(root, '.toolchain', 'dlltool-shim');

if (!existsSync(path.join(cargoBin, 'cargo.exe'))) {
  console.error('未找到项目内 Rust 工具链。请先按 docs/rust-toolchain.md 安装。');
  process.exit(1);
}

const kind = process.env.STUDYDESK_RUST_TARGET ?? 'msvc';
const triple = kind === 'gnu' ? 'x86_64-pc-windows-gnu' : 'x86_64-pc-windows-msvc';
const command = process.argv[2] ?? 'dev';
const extra = process.argv.slice(3);
const targetArgs =
  command === 'dev' || command === 'build' ? ['--target', triple] : [];

const env = {
  ...process.env,
  RUSTUP_HOME: rustupHome,
  CARGO_HOME: cargoHome,
  RUSTUP_TOOLCHAIN: kind === 'gnu' ? 'stable-x86_64-pc-windows-gnu' : 'stable-x86_64-pc-windows-msvc',
  PATH: `${cargoBin}${path.delimiter}${process.env.PATH ?? ''}`,
};

if (kind === 'gnu') {
  env.PATH = `${dlltoolShim}${path.delimiter}${cargoBin}${path.delimiter}${selfContained}${path.delimiter}${binutilsBin}${path.delimiter}${process.env.PATH ?? ''}`;
  env.DLLTOOL = path.join(dlltoolShim, 'dlltool.exe');
  env.STUDYDESK_REAL_DLLTOOL = path.join(selfContained, 'dlltool.exe');
}

const child = spawn('npx', ['tauri', command, ...targetArgs, ...extra], {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});