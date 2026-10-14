// Starts the fake TV on a fixed port so you can point the probe at it:
//   pnpm fake:tv &   then   pnpm probe 127.0.0.1 --port=14180 --insecure --upload
import http from 'node:http';
import { FakeTv } from '../tests/fake.tv.js';
const listen = http.Server.prototype.listen as (this: http.Server, ...a: unknown[]) => http.Server;
http.Server.prototype.listen = function (this: http.Server, ...a: unknown[]) {
    return a[0] === 0 ? listen.call(this, 14180, ...a.slice(1)) : listen.apply(this, a);
} as typeof listen as typeof http.Server.prototype.listen;
const tv = await new FakeTv().start();
console.log(`fake TV on 127.0.0.1:${tv.port}`);
