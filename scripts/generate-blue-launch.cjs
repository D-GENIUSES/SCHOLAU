const fs = require("node:fs");
const path = require("node:path");
const sharp = require(process.argv[2] || "../apps/web/node_modules/sharp");
const root = path.resolve(__dirname,"../apps/web");
const logo = fs.readFileSync(path.join(root,"public/icons/app-white-on-blue-v1.svg"),"utf8");
const data = fs.readFileSync(path.join(root,"lib/startup-images.ts"),"utf8");
const images = JSON.parse(data.slice(data.indexOf("[")).replace(/;\s*$/, ""));
(async()=>{
 for (const entry of images) {
  const [,width,height] = entry.url.match(/(\d+)x(\d+)\.png$/).map(Number);
  const size = Math.round(Math.min(width, height) * 0.34);
  const nested = logo.replace('<svg ', `<svg x="${(width-size)/2}" y="${(height-size)/2}" `)
    .replace('width="512" height="512"', `width="${size}" height="${size}"`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#0866e8"/>${nested}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(root,"public",entry.url));
 }
 console.log(`Generated ${images.length} blue startup images.`);
})().catch(error=>{console.error(error.message);process.exitCode=1});
