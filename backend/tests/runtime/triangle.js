// https://www.khanacademy.org/computer-programming/new/pjs
enableContextMenu();
noStroke();
fill(255, 0, 0);
triangle(0, 0, 400, 400, 0, 400);
fill(0);
for (var i = 0; i < 4; ++i) {
  rect(0, 50 + i * 100, 400, 50);
}
