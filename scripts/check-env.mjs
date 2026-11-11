import fs from 'node:fs';

const paths = [
  'C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe',
  'C:/Program Files (x86)/Microsoft Visual Studio/18',
  'C:/Program Files (x86)/Microsoft Visual Studio/18/BuildTools',
  'C:/Program Files (x86)/Microsoft Visual Studio/18/Community',
  'C:/Program Files (x86)/Microsoft Visual Studio/18/Professional',
  'C:/Program Files/Microsoft Visual Studio/2022',
  'C:/Program Files (x86)/Microsoft/EdgeWebView/Application',
  `${process.env.USERPROFILE}/.cargo/bin/rustc.exe`,
];

for (const path of paths) {
  console.log(`${fs.existsSync(path) ? 'OK  ' : 'MISS'} ${path}`);
}

for (const base of [
  'C:/Program Files (x86)/Microsoft Visual Studio/18',
  'C:/Program Files/Microsoft Visual Studio/2022',
]) {
  if (!fs.existsSync(base)) continue;
  try {
    console.log(`LIST ${base}: ${fs.readdirSync(base).join(', ')}`);
  } catch (error) {
    console.log(`LIST ${base} failed: ${error.message}`);
  }
}