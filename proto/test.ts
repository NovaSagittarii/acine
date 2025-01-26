import * as a from "./dist/common";

let x = a.Frame.create();
x.data = new Uint8Array([1, 2, 3, 4]);
x.id = 5;
let y = a.Frame.encode(x).finish();
console.log(y);
let z = a.Frame.decode(y);
console.log(z);
