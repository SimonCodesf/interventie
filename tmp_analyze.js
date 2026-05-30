var c = require("fs").readFileSync("js/vendor/aframe.min.js", "utf8");

// Zoek ALLE addBehavior occurrences
var i = 0, pos;
console.log("=== Alle addBehavior calls ===");
while ((pos = c.indexOf("addBehavior", i)) > -1) {
  console.log("pos " + pos + ":", c.substring(Math.max(0, pos - 80), pos + 100));
  console.log("---");
  i = pos + 11;
}

// Zoek Component.prototype.play (waar component play method zit)
console.log("\n=== Component play ===");
var pp = c.indexOf("play(){");
while (pp > -1) {
  console.log("pos " + pp + ":", c.substring(Math.max(0, pp - 60), pp + 200));
  console.log("---");
  pp = c.indexOf("play(){", pp + 1);
  if (pp > c.length - 100) break;
}
