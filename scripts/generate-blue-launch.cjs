const fs = require("node:fs");
const path = require("node:path");
const sharp = require(process.argv[2] || "../apps/web/node_modules/sharp");
const root = path.resolve(__dirname,"../apps/web");
const logo = fs.readFileSync(path.join(root,"public/brand/splash-logo.svg"),"utf8");
const data = fs.readFileSync(path.join(root,"lib/startup-images.ts"),"utf8");
const images = JSON.parse(data.slice(data.indexOf("[")).replace(/;\s*$/, ""));
(async()=>{
 for (const entry of images) {
  const [,width,height] = entry.url.match(/(\d+)x(\d+)\.png$/).map(Number);
  const size = Math.min(width*.68, 710);
  const nested = logo.replace('<svg ', `<svg x="${(width-size)/2}" y="${(height-size*240/910)/2}" `).replace('width="910" height="240"', `width="${size}" height="${size*240/910}"`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#0866e8"/>${nested}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(root,"public",entry.url));
 }
 const icon=path.join(root,"public/icons/launch-blue-v4-512.png");
 await sharp(icon).resize(180,180).png().toFile(path.join(root,"public/icons/launch-blue-v4-180.png"));
 fs.copyFileSync(path.join(root,"public/icons/launch-blue-v4-180.png"),path.join(root,"app/apple-icon.png"));
 console.log(`Generated ${images.length} blue startup images and the Apple icon.`);
})().catch(error=>{console.error(error.message);process.exitCode=1});
