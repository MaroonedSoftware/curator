// Starts the fake TV on a fixed port so you can point the probe at it:
//   pnpm fake:tv &   then   pnpm probe 127.0.0.1 --port=14180 --insecure --upload
import http from 'node:http';
import { FakeTv } from '../tests/fake.tv.js';
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (this: http.Server, ...a: any[]) {
    return a[0] === 0 ? listen.call(this, 14180, ...a.slice(1)) : listen.apply(this, a as any);
} as any;
const tv = await new FakeTv().start();
console.log(`fake TV on 127.0.0.1:${tv.port}`);
